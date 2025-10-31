// app/routes/app.search.jsx

import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
// Assuming syncProductsWithShopify, readShortcuts, runSearchScript are in ../utils/products
import { syncProductsWithShopify, readShortcuts, runSearchScript } from "../utils/products";
import { getMonitorState, toggleMonitor } from "../utils/monitor";
import { getVendusApi } from "../services/settings.server";
import { useEffect, useState } from "react";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path"; // Adicionado para manipulação de caminhos

const SHOPIFY_LOCATION_ID = "gid://shopify/Location/102699630920";

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
  await authenticate.admin(request); // Still need to authenticate for the page to load
  const monitorStatus = await getMonitorState(); // Use await aqui
  const vendusApiKeyStatus = (await getVendusApi(authenticate.admin(request))) ? "PRESENT" : "MISSING"; // Adicionado await e admin

  return json({
    monitorStatus,
    shopifyLocationId: SHOPIFY_LOCATION_ID.split('/').pop(),
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

  const execAsync = promisify(exec);

  // Função auxiliar para executar o page_reader_products.js
  // Agora recebe apiKey e productShortcuts para passar ao script externo
  async function runPageReaderScript(apiKey, productShortcuts) {
    try {
      console.log('Running page_reader_products.js via child_process...');
      // Caminho correto para o script e passagem de argumentos
      const scriptPath = path.join(process.cwd(), 'app', 'utils', 'page_reader_products.js');
      const cmd = `node "${scriptPath}" --apiKey=${apiKey} --shortcuts=${JSON.stringify(productShortcuts)}`;

      console.log(`Executing command: ${cmd}`); // Log do comando exato

      const { stdout, stderr } = await execAsync(cmd);
      if (stdout) console.log('🟢 Output from page_reader_products.js:', stdout);
      if (stderr) console.error('🔴 Error from page_reader_products.js:', stderr);
    } catch (err) {
      console.error('❌ Failed to run page_reader_products.js:', err);
    }
  }

  if (intent === "toggleMonitor") {
    const monitorCallback = async () => {
      console.log("Monitor triggered: Running product sync...");

      // Obter chave da API Vendus e atalhos de produtos dentro do callback
      // para garantir que estão atualizados para cada execução periódica
      const vendusApiKey = await getVendusApi(admin);
      const productReferences = await readShortcuts();

      console.log("Monitor Callback: Vendus API Key status:", vendusApiKey ? "PRESENT" : "MISSING/EMPTY");

      if (vendusApiKey && productReferences.length > 0) {
        // --- INÍCIO DA MODIFICAÇÃO CHAVE ---
        // Chamar runPageReaderScript AQUI para garantir a busca periódica da API Vendus
        console.log("Monitor Callback: Running page_reader_products.js to fetch fresh Vendus data...");
        await runPageReaderScript(vendusApiKey, productReferences);
        // --- FIM DA MODIFICAÇÃO CHAVE ---

        console.log("Monitor Callback: Running runSearchScript to process Vendus data...");
        // runSearchScript agora deve processar os dados que runPageReaderScript acabou de buscar/atualizar no JSON
        await runSearchScript(productReferences, vendusApiKey); // Passar apiKey e productReferences aqui também
      } else {
        console.log("Monitor Callback: Vendus API Key ou atalhos de produto ausentes. Pulando atualização de dados Vendus.");
      }

      // Sincronizar produtos após a potencial atualização dos dados
      const syncResult = await syncProductsWithShopify(admin);
      console.log("Monitor sync complete:", syncResult.message);
    };

    const newMonitorState = toggleMonitor(monitorCallback);
    const updatedMonitorStatus = await getMonitorState(); // Obter o estado mais recente após o toggle
    return json({ success: true, newMonitorState, monitorStatus: updatedMonitorStatus });
  } else if (intent === "runInitialSync") {
    // Esta intenção lida com o gatilho manual de sincronização de produtos
    const vendusApiKey = await getVendusApi(admin); // Obter chave da API aqui também
    const productReferences = await readShortcuts();

    // Chamar runPageReaderScript para o sync inicial manual também
    if (vendusApiKey && productReferences.length > 0) {
        await runPageReaderScript(vendusApiKey, productReferences);
    } else {
        console.warn("Action: Chave da API Vendus ou atalhos de produto ausentes. Pulando busca inicial de dados.");
    }

    let syncResult = { success: false, message: "No sync performed or Vendus API key missing.", createdProducts: [], updatedProducts: [], errors: [], sourceData: null };

    // Garantir que os dados do Vendus sejam atualizados antes de sincronizar com o Shopify
    if (vendusApiKey) {
      try {
        if (productReferences.length > 0) {
          console.log("Action: Running runSearchScript to refresh Vendus data...");
          await runSearchScript(productReferences, vendusApiKey); // Passar apiKey e productReferences
        } else {
          console.log("Action: No product shortcuts found. Skipping Vendus data refresh.");
        }
        // Realizar a sincronização após os dados do Vendus serem potencialmente atualizados
        syncResult = await syncProductsWithShopify(admin);
      } catch (error) {
        console.error("Error during initial sync process:", error);
        syncResult.message = `Error during initial sync process: ${error.message}`;
        syncResult.error = error.message;
      }
    } else {
      console.warn("Action: Chave da API Vendus não disponível. Não é possível atualizar dados do Vendus ou sincronizar produtos.");
      syncResult.message = "Chave da API Vendus não disponível. Não é possível atualizar dados do Vendus ou sincronizar produtos.";
      syncResult.error = "Chave da API Vendus não disponível.";
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
