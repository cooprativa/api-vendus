// app/routes/app.search.jsx

import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { syncProductsWithShopify, getPrimaryLocationId } from "../utils/products";
import { readShortcuts } from "../utils/shortcuts.server";
import { runSearchScript } from "../utils/vendusSearch.server";
import { getMonitorState, toggleMonitor } from "../utils/monitor";
import { getVendusApi } from "../services/settings.server";
import { useEffect, useState } from "react";
import path from "path"; // Adicionado para manipulação de caminhos
import { promises as fs } from "fs";

const SEARCH_RESULTS_FILE = path.join(process.cwd(), "app", "data", "search_results.json");

/**
 * Fetches fresh Vendus data for every saved reference, updates search_results.json and syncs with Shopify.
 * References not found in this run keep their previous data instead of being dropped,
 * so a temporary Vendus failure never removes products.
 *
 * @param {Object} admin - The Shopify Admin API client.
 * @returns {Promise<Object>} The result of syncProductsWithShopify.
 */
async function refreshAndSync(admin) {
  const vendusApiKey = getVendusApi();
  if (!vendusApiKey) {
    return {
      success: false,
      message: "Chave da API Vendus não disponível. Não é possível atualizar dados do Vendus ou sincronizar produtos.",
      error: "Chave da API Vendus não disponível.",
      createdProducts: [],
      updatedProducts: [],
      errors: [],
      sourceData: null
    };
  }

  const productReferences = await readShortcuts(admin);

  if (productReferences.length > 0) {
    let previousFound = {};
    try {
      previousFound = JSON.parse(await fs.readFile(SEARCH_RESULTS_FILE, "utf-8")).found || {};
    } catch (error) {
      console.log("No previous search_results.json, starting fresh.");
    }

    const freshResults = await runSearchScript(productReferences, vendusApiKey);

    const found = {};
    const stale = [];
    for (const ref of productReferences) {
      if (freshResults.found[ref]) {
        found[ref] = freshResults.found[ref];
      } else if (previousFound[ref]) {
        found[ref] = previousFound[ref];
        stale.push(ref);
      }
    }
    if (stale.length > 0) {
      console.warn(`⚠️ Not found in Vendus this run, keeping previous data: ${stale.join(", ")}`);
    }

    await fs.mkdir(path.dirname(SEARCH_RESULTS_FILE), { recursive: true });
    await fs.writeFile(SEARCH_RESULTS_FILE, JSON.stringify({
      searchDate: freshResults.searchDate,
      totalSearched: productReferences.length,
      totalFound: Object.keys(found).length,
      found,
      notFound: freshResults.notFound
    }, null, 2));
  } else {
    console.log("No saved references. Skipping Vendus refresh.");
  }

  return syncProductsWithShopify(admin, productReferences);
}

/**
 * Remix loader function to handle initial data loading and monitor state.
 * This function runs on the server.
 *
 * It no longer performs an initial product sync, but fetches monitor status.
 *
 * @param {Object} args - The arguments object provided by Remix.
 * @param {Request} args.request - The incoming request object.
 * @returns {Promise<Response>} A JSON response containing monitor state and Shopify location ID.
 */
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const monitorStatus = await getMonitorState(); // Use await aqui
  const vendusApiKeyStatus = getVendusApi() ? "PRESENT" : "MISSING";
  const shopifyLocationId = await getPrimaryLocationId(admin);

  return json({
    monitorStatus,
    shopifyLocationId: shopifyLocationId ? shopifyLocationId.split('/').pop() : "não encontrada",
    vendusApiKeyStatus
  });
}

/**
 * Remix action function to handle starting/stopping the monitor and running an initial sync.
 * This function runs on the server when a form is submitted to this route.
 *
 * @param {Object} args - The arguments object provided by Remix.
 * @param {Request} args.request - The incoming request object.
 * @returns {Promise<Response>} A JSON response indicating the action result.
 */
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "toggleMonitor") {
    const monitorCallback = async () => {
      console.log("Monitor triggered: Running product sync...");
      const syncResult = await refreshAndSync(admin);
      console.log("Monitor sync complete:", syncResult.message || syncResult.error);
    };

    const newMonitorState = toggleMonitor(monitorCallback);
    const updatedMonitorStatus = await getMonitorState(); // Obter o estado mais recente após o toggle
    return json({ success: true, newMonitorState, monitorStatus: updatedMonitorStatus });
  } else if (intent === "runInitialSync") {
    // Esta intenção lida com o gatilho manual de sincronização de produtos
    let syncResult;
    try {
      syncResult = await refreshAndSync(admin);
    } catch (error) {
      console.error("Error during initial sync process:", error);
      syncResult = {
        success: false,
        message: `Error during initial sync process: ${error.message}`,
        error: error.message,
        createdProducts: [],
        updatedProducts: [],
        errors: [],
        sourceData: null
      };
    }

    return json(syncResult);
  }

  // Lidar com outras ações, se necessário
  return json({ success: false, message: "Intenção de ação inválida." }, { status: 400 });
}

export default function CreateFromJson() {
  const loaderData = useLoaderData();
  const fetcher = useFetcher(); // useFetcher para mutações não-navegacionais

  // Estado para gerenciar a exibição local do status do monitor
  const [isMonitorRunning, setIsMonitorRunning] = useState(loaderData.monitorStatus.isRunning);
  const [lastMonitorRun, setLastMonitorRun] = useState(loaderData.monitorStatus.lastRun);
  const [nextMonitorRun, setNextMonitorRun] = useState(loaderData.monitorStatus.nextRun);

  // Estado para resultados da sincronização inicial, gerenciado por fetcher.data
  const [initialSyncResults, setInitialSyncResults] = useState(null);
  const [initialSyncError, setInitialSyncError] = useState(null);

  // Atualizar estado local quando os dados do fetcher mudam (após a ação ser concluída)
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.monitorStatus) {
        // Isso significa que a ação do fetcher foi para 'toggleMonitor'
        setIsMonitorRunning(fetcher.data.monitorStatus.isRunning);
        setLastMonitorRun(fetcher.data.monitorStatus.lastRun);
        setNextMonitorRun(fetcher.data.monitorStatus.nextRun);
      } else {
        // Isso significa que a ação do fetcher foi para 'runInitialSync'
        if (fetcher.data.success !== undefined) {
          setInitialSyncResults(fetcher.data);
          setInitialSyncError(null);
        } else if (fetcher.data.error) {
          setInitialSyncError(fetcher.data.error);
          setInitialSyncResults(null);
        }
      }
    }
  }, [fetcher.data]);

  // Lidar com o clique do botão de toggle para o monitor
  const handleToggleMonitor = () => {
    fetcher.submit({ intent: "toggleMonitor" }, { method: "post" });
  };

  // Lidar com o clique do botão de sincronização manual
  const handleRunInitialSync = () => {
    setInitialSyncResults(null); // Limpar resultados anteriores antes de uma nova sincronização
    setInitialSyncError(null); // Limpar erros anteriores
    fetcher.submit({ intent: "runInitialSync" }, { method: "post" });
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Inter", maxWidth: "1200px", margin: "0 auto", borderRadius: "8px" }}>
    <h1 style={{ textAlign: "center", color: "#121212ff", marginBottom: "20px" }}>Sincronização de Produtos Shopify</h1>
<p style={{ textAlign: "center", color: "#555", marginBottom: "30px" }}>
Esta página processa os dados de produtos do arquivo JSON de resultados de pesquisa e os sincroniza com o Shopify.
</p>

      {/* <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#e7f3ff", borderRadius: "8px", border: "1px solid #b8daff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
        <h3 style={{ color: "#0056b3", marginBottom: "15px" }}>📁 File Path Information:</h3>
        <p style={{ marginBottom: "5px" }}><strong>Data Directory:</strong> <code>app/data/</code></p>
        <p style={{ marginBottom: "5px" }}><strong>Search Results File:</strong> <code>search_results.json</code></p>
        <p style={{ marginBottom: "5px" }}><strong>Location ID:</strong> <code>{loaderData.shopifyLocationId}</code></p>
        <p style={{ marginBottom: "0" }}><strong>Stock Tracking:</strong> <span style={{ color: "#28a745", fontWeight: "bold" }}>✅ Always Enabled</span></p>
      </div> */}

      {/* Monitor Control Section */}
      <div style={{
        marginBottom: "30px",
        padding: "20px",
        backgroundColor: "#f0f8ff",
        borderRadius: "10px",
        border: "1px solid #cce5ff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        textAlign: "center"
      }}>
              <h3 style={{ color: "#0056b3", marginBottom: "20px" }}>⏱️ Monitor de Sincronização Automática</h3>
      <p style={{ fontSize: "1.1em", marginBottom: "15px", color: "#333" }}>
        Status: <span style={{ fontWeight: "bold", color: isMonitorRunning ? "#28a745" : "#dc3545" }}>
          {isMonitorRunning ? "EM EXECUÇÃO" : "PARADO"}
        </span>
      </p>

        {/* <p style={{ fontSize: "0.9em", color: "#666", marginBottom: "10px" }}>
          Intervalo: {loaderData.monitorStatus.interval / 1000} segundos
        </p> */}
        {lastMonitorRun && (
  <p style={{ fontSize: "0.9em", color: "#666", marginBottom: "10px" }}>
    Última execução: {new Date(lastMonitorRun).toLocaleString()}
  </p>
)}
{nextMonitorRun && isMonitorRunning && (
  <p style={{ fontSize: "0.9em", color: "#666", marginBottom: "20px" }}>
    Próxima execução: {new Date(nextMonitorRun).toLocaleString()}
  </p>
)}

        <button
          onClick={handleToggleMonitor}
          style={{
            padding: "12px 25px",
            backgroundColor: isMonitorRunning ? "#dc3545" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            transition: "background-color 0.3s ease, transform 0.2s ease",
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = isMonitorRunning ? "#c82333" : "#0056b3"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = isMonitorRunning ? "#dc3545" : "#007bff"}
          onMouseDown={(e) => e.currentTarget.style.transform = "translateY(1px)"}
          onMouseUp={(e) => e.currentTarget.style.transform = "translateY(0)"}
          disabled={fetcher.state === "submitting"}
        >
        {fetcher.state === "submitting" ? "Atualizando..." : (isMonitorRunning ? "Parar Monitoramento" : "Iniciar Monitoramento")}
        </button>
      </div>

      {/* Display Initial Sync Results */}
      {initialSyncResults && initialSyncResults.success ? (
        <div style={{
          padding: "20px",
          backgroundColor: "#d4edda",
          color: "#155724",
          borderRadius: "8px",
          border: "1px solid #c3e6cb",
          marginBottom: "20px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        }}>
       <h2 style={{ textAlign: "center", color: "#155724", marginBottom: "15px" }}>✅ Processamento Inicial Concluído!</h2>
<p style={{ marginBottom: "25px", textAlign: "center" }}>{initialSyncResults.message}</p>

{initialSyncResults.createdProducts.length > 0 && (
  <div style={{ marginBottom: "30px" }}>
    <h3 style={{ color: "#28a745", marginBottom: "20px", borderBottom: "1px solid #c3e6cb", paddingBottom: "10px" }}>
      🆕 Produtos Criados ({initialSyncResults.createdProducts.length})
    </h3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
      {initialSyncResults.createdProducts.map((item, index) => (
        <div
          key={index}
          style={{
            padding: "20px",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            border: "2px solid #28a745",
            boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", color: "#495057", fontSize: "1.1em" }}>{item.product.title}</h4>
          <div style={{ fontSize: "14px", lineHeight: "1.6", color: "#666" }}>
            <p style={{ margin: "5px 0" }}><strong>SKU:</strong> {item.reference}</p>
            <p style={{ margin: "5px 0" }}><strong>Preço:</strong> €{item.price}</p>
            <p style={{ margin: "5px 0" }}><strong>Estoque:</strong> {item.stock !== undefined ? `${item.stock} unidades` : 'N/D'}</p>
            <p style={{ margin: "5px 0" }}><strong>Identificador:</strong> {item.product.handle}</p>
            <p style={{ margin: "5px 0" }}><strong>Rastreamento:</strong> <span style={{ color: "#28a745", fontWeight: "bold" }}>✅ Ativado</span></p>
          </div>
          <span
            style={{
              backgroundColor: "#28a745",
              color: "white",
              padding: "6px 12px",
              borderRadius: "5px",
              fontSize: "13px",
              fontWeight: "bold",
              marginTop: "15px",
              display: "inline-block",
            }}
          >
            CRIADO
          </span>
        </div>
      ))}
    </div>
  </div>
)}

{initialSyncResults.updatedProducts.length > 0 && (
  <div style={{ marginBottom: "30px" }}>
    <h3 style={{ color: "#007bff", marginBottom: "20px", borderBottom: "1px solid #cce5ff", paddingBottom: "10px" }}>
      🔄 Produtos Atualizados ({initialSyncResults.updatedProducts.length})
    </h3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
      {initialSyncResults.updatedProducts.map((item, index) => (
        <div
          key={index}
          style={{
            padding: "20px",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            border: "2px solid #007bff",
            boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", color: "#495057", fontSize: "1.1em" }}>{item.product.title}</h4>
          <div style={{ fontSize: "14px", lineHeight: "1.6", color: "#666" }}>
            <p style={{ margin: "5px 0" }}><strong>SKU:</strong> {item.reference}</p>
            <p style={{ margin: "5px 0" }}><strong>Preço:</strong> €{item.price}</p>
            <p style={{ margin: "5px 0" }}><strong>Estoque:</strong> {item.stock !== undefined ? `${item.stock} unidades` : 'N/D'}</p>
            <p style={{ margin: "5px 0" }}><strong>Identificador:</strong> {item.product.handle}</p>
            <p style={{ margin: "5px 0" }}><strong>Rastreamento:</strong> <span style={{ color: "#28a745", fontWeight: "bold" }}>✅ Ativado</span></p>
          </div>
          <span
            style={{
              backgroundColor: "#007bff",
              color: "white",
              padding: "6px 12px",
              borderRadius: "5px",
              fontSize: "13px",
              fontWeight: "bold",
              marginTop: "15px",
              display: "inline-block",
            }}
          >
            ATUALIZADO
          </span>
        </div>
      ))}
    </div>
  </div>
)}

</div>
) : initialSyncError ? (
  <div
    style={{
      padding: "20px",
      backgroundColor: "#f8d7da",
      color: "#721c24",
      borderRadius: "8px",
      border: "1px solid #f5c6cb",
      marginBottom: "20px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    }}
  >
    <h2 style={{ textAlign: "center", color: "#721c24", marginBottom: "15px" }}>❌ Erro</h2>
    <p style={{ textAlign: "center", marginBottom: "10px" }}>{initialSyncError}</p>
  </div>
) : null}



      {initialSyncResults && initialSyncResults.errors && initialSyncResults.errors.length > 0 && (
        <div style={{
          padding: "20px",
          backgroundColor: "#fff3cd",
          color: "#856404",
          borderRadius: "8px",
          border: "1px solid #ffeeba",
          marginBottom: "20px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        }}>
          <h3 style={{ color: "#856404", marginBottom: "20px", borderBottom: "1px solid #ffeeba", paddingBottom: "10px" }}>⚠️ Errors ({initialSyncResults.errors.length})</h3>
          <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #ffeeba", borderRadius: "5px", padding: "10px", backgroundColor: "#fff" }}>
            {initialSyncResults.errors.map((error, i) => (
              <div key={i} style={{
                margin: "10px 0",
                padding: "15px",
                backgroundColor: "#f8d7da",
                borderRadius: "5px",
                border: "1px solid #dc3545",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
              }}>
                <strong style={{ color: "#dc3545" }}>Reference: {error.reference}</strong> ({error.action})<br/>
                <span style={{ fontSize: "14px", color: "#721c24" }}>
                  {error.error || (error.errors && error.errors.map(e => `${e.field}: ${e.message}`).join(', '))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {initialSyncResults && initialSyncResults.sourceData && (
        <div style={{
          padding: "20px",
          backgroundColor: "#e7f3ff",
          borderRadius: "8px",
          border: "1px solid #b8daff",
          marginBottom: "20px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        }}>
         <h3 style={{ color: "#0056b3", marginBottom: "20px", borderBottom: "1px solid #b8daff", paddingBottom: "10px" }}>
  📊 Resumo dos Dados de Origem
</h3>
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "15px",
    fontSize: "14px",
    color: "#555",
  }}
>
  <div>
    <strong>Data da Pesquisa:</strong><br />
    {new Date(initialSyncResults.sourceData.searchDate).toLocaleString()}
  </div>
  <div>
    <strong>Total Encontrado:</strong><br />
    {initialSyncResults.sourceData.totalFound} produtos
  </div>
  <div>
    <strong>Total Pesquisado:</strong><br />
    {initialSyncResults.sourceData.totalSearched} produtos
  </div>
  <div>
    <strong>Status do Arquivo:</strong><br />
    ✅ Carregado com sucesso
  </div>
</div>
</div>
)}


      <div style={{ textAlign: "center", marginTop: "40px" }}>
        <button
          onClick={handleRunInitialSync}
          style={{
            padding: "15px 30px",
            backgroundColor: "#007cba",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "17px",
            fontWeight: "bold",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            transition: "background-color 0.3s ease, transform 0.2s ease",
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#005f8a"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#007cba"}
          onMouseDown={(e) => e.currentTarget.style.transform = "translateY(1px)"}
          onMouseUp={(e) => e.currentTarget.style.transform = "translateY(0)"}
          disabled={fetcher.state === "submitting"}
        >
      {fetcher.state === "submitting" ? "Processando..." : "🔄 Atualizar e Processar Dados"}
        </button>
      </div>
    </div>
  );
}
