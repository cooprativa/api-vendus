import {
  Box,
  Card,
  Layout,
  Link,
  List,
  Page,
  Text,
  BlockStack,
  Banner,
  Button,
  TextField,
  InlineStack,
  Tag,
  Spinner,
  Modal,
  DataTable,
  MediaCard, // Added for displaying images
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { json } from "@remix-run/node";
import { useLoaderData, Form, useFetcher } from "@remix-run/react";
import { getVendusApi } from "../services/settings.server";
import path from "path";
import { promises as fs } from "fs";
import { useState, useCallback } from "react";

// Use process.cwd() to get the current working directory
const DATA_DIR = path.join(process.cwd(), "app", "data");
const SHORTCUTS_FILE = path.join(DATA_DIR, "shortcuts.json");
const SEARCH_RESULTS_FILE = path.join(DATA_DIR, "search_results.json");

// Helper function to ensure data directory exists
async function ensureDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log("Data directory ensured:", DATA_DIR);
  } catch (error) {
    console.error("Failed to create data directory:", error);
    throw error;
  }
}

// Helper function to read shortcuts with better error handling
async function readShortcuts() {
  try {
    await ensureDataDirectory();
    const shortcutsRaw = await fs.readFile(SHORTCUTS_FILE, "utf-8");
    const shortcuts = JSON.parse(shortcutsRaw);
    console.log("Successfully read shortcuts:", shortcuts);
    return Array.isArray(shortcuts) ? shortcuts : [];
  } catch (error) {
    console.log("No shortcuts file found or error reading it, starting with empty array:", error.message);
    return [];
  }
}

// Helper function to write shortcuts with better error handling
async function writeShortcuts(shortcuts) {
  try {
    await ensureDataDirectory();
    const shortcutsArray = Array.isArray(shortcuts) ? shortcuts : [];
    await fs.writeFile(SHORTCUTS_FILE, JSON.stringify(shortcutsArray, null, 2));
    console.log("Successfully wrote shortcuts:", shortcutsArray);
    return true;
  } catch (error) {
    console.error("Failed to write shortcuts file:", error);
    throw error;
  }
}

export async function loader() {
  const vendusApi = getVendusApi();
  let apiCallResult = null;
  let permanentShortcuts = [];
  let searchResults = null;

  // Read shortcuts with better error handling
  permanentShortcuts = await readShortcuts();

  // Load previous search results if they exist
  try {
    await ensureDataDirectory();
    const resultsRaw = await fs.readFile(SEARCH_RESULTS_FILE, "utf-8");
    searchResults = JSON.parse(resultsRaw);
  } catch (error) {
    console.log("No search results file found:", error.message);
    searchResults = null;
  }

  // NOTE: This initial API call using /ws/products is for general status check.
  // The detailed product fetching (with variants, images, etc.) will happen via runSearchScript
  // which uses /ws/v1.1/products.
  if (vendusApi) {
    try {
      const response = await fetch(`https://www.vendus.pt/ws/products?api_key=${vendusApi}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erro na API - Status: ${response.status}, Resposta: ${errorText}`);

        let errorMessage = "Falha ao chamar a API do Vendus";
        if (response.status === 401) {
          errorMessage = "Chave da API inválida. Verifique suas credenciais.";
        } else if (response.status === 403) {
          errorMessage = "Acesso proibido. Verifique as permissões da sua API.";
        } else if (response.status === 404) {
          errorMessage = "Endpoint da API não encontrado. Verifique a URL.";
        }

        apiCallResult = {
          error: `${errorMessage} (Status: ${response.status})`
        };
      } else {
        const data = await response.json();

        const filePath = path.join(DATA_DIR, "vendus_products.json");
        try {
          await ensureDataDirectory();
          await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (fileError) {
          console.warn("Não foi possível salvar o arquivo:", fileError);
        }

        apiCallResult = {
          success: true,
          data: data,
          totalProducts: Array.isArray(data) ? data.length : 1,
          message: "Chamada à API realizada com sucesso e dados guardados!",
        };
      }
    } catch (error) {
      console.error("Falha na chamada à API:", error);

      let userFriendlyError = "Falha ao chamar a API do Vendus. Verifique sua chave da API e conexão com a internet.";

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        userFriendlyError = "Erro de rede. Verifique sua conexão com a internet.";
      } else if (error.message.includes('JSON')) {
        userFriendlyError = "Resposta inválida da API. O serviço pode estar temporariamente indisponível.";
      }

      apiCallResult = {
        error: userFriendlyError
      };
    }
  } else {
    apiCallResult = {
      error: "Nenhuma chave da API configurada. Por favor, configure sua chave da API Vendus nas Definições primeiro."
    };
  }

  return json({
    hasApiKey: !!vendusApi,
    apiKeyLength: vendusApi ? vendusApi.length : 0,
    apiCallResult,
    permanentShortcuts,
    searchResults,
    // Add debug info
    debug: {
      dataDir: DATA_DIR,
      shortcutsFile: SHORTCUTS_FILE,
      shortcutsCount: permanentShortcuts.length
    }
  });
}

export async function action({ request }) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  console.log("Action called with type:", actionType);

  if (actionType === "add") {
    try {
      const shortcutsToAdd = JSON.parse(formData.get("shortcuts"));
      console.log("Shortcuts to add:", shortcutsToAdd);

      // Read existing shortcuts
      const existingShortcuts = await readShortcuts();
      console.log("Existing shortcuts:", existingShortcuts);

      // Filter out duplicates
      const newShortcuts = shortcutsToAdd.filter(s => !existingShortcuts.includes(s));
      console.log("New shortcuts after filtering:", newShortcuts);

      // Combine and write
      const updatedShortcuts = [...existingShortcuts, ...newShortcuts];
      console.log("Updated shortcuts:", updatedShortcuts);

      await writeShortcuts(updatedShortcuts);

      return json({
        success: true,
        message: `Added ${newShortcuts.length} new shortcuts`,
        shortcuts: updatedShortcuts
      });
    } catch (error) {
      console.error("Error adding shortcuts:", error);
      return json({
        error: `Failed to add shortcuts: ${error.message}`,
        debug: error.stack
      });
    }
  }

  else if (actionType === "remove") {
    try {
      const shortcutToRemove = formData.get("shortcut");
      console.log("Shortcut to remove:", shortcutToRemove);

      const existingShortcuts = await readShortcuts();
      console.log("Existing shortcuts before removal:", existingShortcuts);

      const updatedShortcuts = existingShortcuts.filter(s => s !== shortcutToRemove);
      console.log("Updated shortcuts after removal:", updatedShortcuts);

      await writeShortcuts(updatedShortcuts);

      return json({
        success: true,
        message: `Removed shortcut: ${shortcutToRemove}`,
        shortcuts: updatedShortcuts
      });
    } catch (error) {
      console.error("Error removing shortcut:", error);
      return json({
        error: `Failed to remove shortcut: ${error.message}`,
        debug: error.stack
      });
    }
  }

  else if (actionType === "search") {
    try {
      const vendusApi = getVendusApi();
      const permanentShortcuts = await readShortcuts();

      if (!vendusApi || permanentShortcuts.length === 0) {
        return json({ error: "API key not configured or no shortcuts to search" });
      }

      const searchResults = await runSearchScript(permanentShortcuts, vendusApi);

      // Save results to file
      await ensureDataDirectory();
      await fs.writeFile(SEARCH_RESULTS_FILE, JSON.stringify(searchResults, null, 2));

      return json({ success: true, searchResults });
    } catch (error) {
      console.error("Search failed:", error);
      return json({ error: `Search failed: ${error.message}` });
    }
  }

  return json({ error: "Unknown action type" });
}

// Search script function (updated for robust image, color, size extraction)
async function runSearchScript(refs, apiKey) {
  // Updated URL for detailed product information including variants and images
  const URL = "https://www.vendus.pt/ws/v1.1/products";

  const apiClient = {
    get: async (url, options) => {
      const params = new URLSearchParams(options.params);
      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
          'Accept': 'application/json',
          'User-Agent': 'Shopify App API Client',
        },
        // It's good practice to have a timeout for external API calls
        // Note: fetch API does not directly support a 'timeout' option.
        // You would typically implement this using AbortController.
        // For simplicity, we'll omit it here, but keep in mind for production.
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data };
    }
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function fetchPageWithRetry(page, attempt = 0) {
    const maxRetries = 3;
    try {
      const response = await apiClient.get(URL, {
        params: {
          page: page,
          per_page: 100
        }
      });
      return { page, data: response.data, success: true, attempts: attempt + 1 };
    } catch (error) {
      const shouldRetry = attempt < maxRetries;
      if (shouldRetry) {
        const delay = 1000 * Math.pow(2, attempt);
        await sleep(Math.min(delay, 8000));
        return fetchPageWithRetry(page, attempt + 1);
      }
      return { page, data: null, success: false, error: error.message, attempts: attempt + 1 };
    }
  }

  function checkProductForRefs(produto, refs) {
    const foundRefs = [];
    for (const ref of refs) {
      if (produto.reference === ref ||
          produto.code === ref ||
          produto.id?.toString() === ref ||
          (!isNaN(ref) && produto.id === parseInt(ref))) {
        foundRefs.push(ref);
        continue;
      }

      // Check variants for matches
      if (produto.variants && Array.isArray(produto.variants)) {
        for (const variant of produto.variants) {
          // Check the 'variant' object inside the main variant block
          if (variant.variant) {
            if (variant.variant.code === ref || variant.variant.title === ref || variant.variant.reference === ref ||
                (variant.variant.id?.toString() === ref || (!isNaN(ref) && variant.variant.id === parseInt(ref)))) {
              foundRefs.push(ref);
              break;
            }
          }
          // Check 'product_variants' if they exist
          if (variant.product_variants && Array.isArray(variant.product_variants)) {
              for (const pv of variant.product_variants) {
                  if (pv.code === ref || pv.text === ref || pv.barcode === ref ||
                      (pv.id?.toString() === ref || (!isNaN(ref) && pv.id === parseInt(ref)))) {
                      foundRefs.push(ref);
                      break; // Found in product_variant, no need to check other product_variants for this variant
                  }
              }
          }
        }
      }
    }
    return foundRefs;
  }

  const foundRefs = new Map();
  const remainingRefs = new Set(refs);
  const concurrency = 6;
  const maxPages = 1000; // Limit to prevent excessive API calls in case of many pages

  let currentPage = 1;
  let isLastPage = false;

  while (remainingRefs.size > 0 && !isLastPage && currentPage <= maxPages) {
    const pagesToFetch = [];
    for (let i = 0; i < concurrency && currentPage + i <= maxPages; i++) {
      pagesToFetch.push(currentPage + i);
    }

    const pagePromises = pagesToFetch.map((page, index) =>
      new Promise(resolve =>
        setTimeout(() => resolve(fetchPageWithRetry(page)), index * 100)
      )
    );

    const pageResults = await Promise.all(pagePromises);

    for (const result of pageResults) {
      if (!result.success || !result.data) continue;

      let produtos = Array.isArray(result.data) ? result.data :
        result.data.data || result.data.products ||
        result.data.items || result.data.results;

      if (!Array.isArray(produtos)) continue;

      // Assuming Vendus API returns an empty array or less than per_page for the last page
      if (produtos.length < 100) { // If per_page is 100
        isLastPage = true;
      }

      for (let index = 0; index < produtos.length; index++) {
        const produto = produtos[index];
        if (typeof produto !== 'object' || produto === null) continue; // Ensure it's a valid object

        const foundInProduct = checkProductForRefs(produto, Array.from(remainingRefs));

        if (foundInProduct.length > 0) {
          // --- BEGIN of Image, Color, Size extraction ---
          const images = [];
          // Check if 'images' is an object and extract URLs
          if (produto.images && typeof produto.images === 'object') {
              // Prefer 'm' (medium) size if available, otherwise 'xs' (extra small)
              // You can add 'l' or other sizes if Vendus provides them
              if (produto.images.m) {
                  images.push(produto.images.m);
              } else if (produto.images.xs) {
                  images.push(produto.images.xs);
              }
          }

          const colors = new Set(); // Use Set to automatically handle unique values
          const sizes = new Set();   // Use Set to automatically handle unique values

          // Check if there are variants and they are an array
          if (produto.variants && Array.isArray(produto.variants)) {
            produto.variants.forEach(variant => {
              // Add the main variant title as a color (e.g., "PRETO", "LEOPARDO", "AZUL MARINHO")
              // Ensure variant.variant exists before accessing title
              if (variant.variant && variant.variant.title) {
                colors.add(variant.variant.title.trim()); // Trim to remove trailing spaces like in "LEOPARDO "
              }

              // Check product_variants for combined color/size in 'text' field
              if (variant.product_variants && Array.isArray(variant.product_variants)) {
                variant.product_variants.forEach(pv => {
                  if (pv.text) {
                    const parts = pv.text.split('/').map(s => s.trim());
                    if (parts.length === 2) {
                      // Assuming "Color / Size" format: "COLOR / SIZE"
                      colors.add(parts[0]);
                      sizes.add(parts[1]);
                    } else if (parts.length === 1) {
                      // If only one part, it might be just a color or just a size if not already captured
                      // This is a heuristic, adjust as needed if Vendus has other formats
                      // For now, it's safer to rely on variant.variant.title for primary color
                      // and the two-part split for distinct color/size.
                    }
                  }
                });
              }
            });
          }
          // Convert Sets to Arrays for storage
          const finalColors = Array.from(colors);
          const finalSizes = Array.from(sizes);
          // --- END of Image, Color, Size extraction ---


          foundInProduct.forEach(ref => {
            foundRefs.set(ref, {
              page: result.page,
              position: index + 1,
              productData: {
                id: produto.id,
                title: produto.title,
                reference: produto.reference,
                code: produto.code || produto.supplier_code,
                barcode: produto.barcode,
                description: produto.description,
                price: produto.gross_price || produto.price,
                price_without_tax: produto.price_without_tax,
                supply_price: produto.supply_price,
                stock: produto.stock,
                stock_alert: produto.stock_alert,
                status: produto.status,
                category_id: produto.category_id,
                brand_id: produto.brand_id,
                type_id: produto.type_id,
                unit_id: produto.unit_id,
                tax_id: produto.tax_id,
                stock_stores: produto.stock_store || [],
                compound: produto.compound,
                prices: produto.prices || [],
                // Use the new fields for images, colors, and sizes
                images: images,
                colors: finalColors,
                sizes: finalSizes,
                variants: produto.variants || [], // Keep full variant data for detailed view
              }
            });
            remainingRefs.delete(ref);
          });
        }

        if (remainingRefs.size === 0) break;
      }

      if (remainingRefs.size === 0) break;
    }

    currentPage += concurrency;

    if (remainingRefs.size > 0 && !isLastPage) {
      await sleep(200);
    }

    if (remainingRefs.size === 0) break;
  }

  // Convert Map to object for JSON serialization
  const results = {
    searchDate: new Date().toISOString(),
    totalSearched: refs.length,
    totalFound: foundRefs.size,
    found: Object.fromEntries(foundRefs),
    notFound: Array.from(remainingRefs)
  };

  return results;
}

export default function AdditionalPage() {
  const loaderData = useLoaderData();
  const { hasApiKey, apiKeyLength, apiCallResult, permanentShortcuts, searchResults, debug } = loaderData;
  const fetcher = useFetcher();

  const [shortcuts, setShortcuts] = useState([]);
  const [newShortcut, setNewShortcut] = useState("");
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showProductDetailsModal, setShowProductDetailsModal] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);

  const isSearching = fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "search";
  const isSubmitting = fetcher.state === "submitting";

  const handleAddShortcut = useCallback(() => {
    const trimmedShortcut = newShortcut.trim();

    if (!trimmedShortcut) {
      return;
    }

    // Check if shortcut already exists in temporary list or permanent list
    const alreadyInTemp = shortcuts.includes(trimmedShortcut);
    const alreadyInPermanent = permanentShortcuts.includes(trimmedShortcut);

    if (alreadyInTemp || alreadyInPermanent) {
      console.log('Shortcut already exists');
      return;
    }

    setShortcuts(prev => [...prev, trimmedShortcut]);
    setNewShortcut("");
  }, [newShortcut, shortcuts, permanentShortcuts]);

  const handleAddShortcutKeyPress = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddShortcut();
    }
  }, [handleAddShortcut]);

  const handleSubmitShortcut = useCallback(() => {
    if (shortcuts.length === 0) return;

    const formData = new FormData();
    formData.append("actionType", "add");
    formData.append("shortcuts", JSON.stringify(shortcuts));
    fetcher.submit(formData, { method: "post" });

    // Clear the temporary shortcuts after submitting
    setShortcuts([]);
    setNewShortcut("");
  }, [shortcuts, fetcher]);

  const handleRemovePermanent = useCallback((shortcut) => {
    const formData = new FormData();
    formData.append("actionType", "remove");
    formData.append("shortcut", shortcut);
    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);

  const handleRunSearch = useCallback(() => {
    const formData = new FormData();
    formData.append("actionType", "search");
    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);

  const handleRemoveFromTemp = useCallback((shortcutToRemove) => {
    setShortcuts(prev => prev.filter(s => s !== shortcutToRemove));
  }, []);

  const handleProductRowClick = useCallback((ref, productData) => {
    setSelectedProductDetails({ ref, ...productData });
    setShowProductDetailsModal(true);
  }, []);

  // Prepare data for the results table
  const resultsTableRows = searchResults ?
    Object.entries(searchResults.found).map(([ref, data]) => [
      ref,
      data.productData.title || 'N/A',
      data.productData.id || 'N/A',
      data.productData.reference || 'N/A',
      data.productData.code || 'N/A',
      data.page.toString(),
      data.position.toString(),
      data.productData.images?.length > 0 ? 'Sim' : 'Não', // Has Images
      data.productData.colors?.length > 0 ? data.productData.colors.join(', ') : 'N/A', // Colors
      data.productData.sizes?.length > 0 ? data.productData.sizes.join(', ') : 'N/A', // Sizes
    ]) : [];

  const notFoundList = searchResults?.notFound || [];

  return (
    <Page>
      <TitleBar title="Integração com a API Vendus" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Status da Integração com a API
              </Text>

              {/* Debug Information */}
              {/* <Banner status="info">
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd">Debug Info:</Text>
                  <Text as="p" variant="bodySm">Data Directory: {debug?.dataDir}</Text>
                  <Text as="p" variant="bodySm">Shortcuts File: {debug?.shortcutsFile}</Text>
                  <Text as="p" variant="bodySm">Shortcuts Count: {debug?.shortcutsCount}</Text>
                </BlockStack>
              </Banner> */}

              {hasApiKey ? (
                <Banner status="success">
                  <p>Chave da API do Vendus configurada (Tamanho: {apiKeyLength} caracteres)</p>
                </Banner>
              ) : (
                <Banner status="warning">
                  <p>Nenhuma chave da API do Vendus configurada. Por favor, configure nas Definições primeiro.</p>
                </Banner>
              )}

              {apiCallResult?.error && (
                <Banner status="critical">
                  <p>{apiCallResult.error}</p>
                </Banner>
              )}

              {apiCallResult?.success && (
                <Banner status="success">
                  <BlockStack gap="200">
                    <p>{apiCallResult.message}</p>
                  </BlockStack>
                </Banner>
              )}

              {fetcher.data?.error && (
                <Banner status="critical">
                  <BlockStack gap="100">
                    <p>{fetcher.data.error}</p>
                    {fetcher.data.debug && (
                      <Text as="p" variant="bodySm">Debug: {fetcher.data.debug}</Text>
                    )}
                  </BlockStack>
                </Banner>
              )}

              {fetcher.data?.success && fetcher.data?.message && (
                <Banner status="success">
                  <p>{fetcher.data.message}</p>
                </Banner>
              )}

              {fetcher.data?.success && fetcher.data?.searchResults && (
                <Banner status="success">
                  <p>Pesquisa concluída! {fetcher.data.searchResults.totalFound} de {fetcher.data.searchResults.totalSearched} referências encontradas.</p>
                </Banner>
              )}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">
                Produtos Externos
              </Text>
              {searchResults && (
                <BlockStack gap="200">
                  <InlineStack gap="200" align="space-between">
                    <Text as="p" variant="bodyMd">
                      Última pesquisa: {new Date(searchResults.searchDate).toLocaleString('pt-PT')}
                    </Text>
                    <Button onClick={() => setShowResultsModal(true)}>
                      Ver Resultados Detalhados
                    </Button>
                  </InlineStack>
                  <Text as="p" variant="bodyMd">
                    Encontrados: {searchResults.totalFound}/{searchResults.totalSearched} referências
                  </Text>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Adicionar produtos
              </Text>

              <InlineStack gap="200" align="end">
                <Box style={{ flexGrow: 1 }}>
                  <TextField
                    label="Adicionar novo atalho"
                    value={newShortcut}
                    onChange={setNewShortcut}
                    onKeyPress={handleAddShortcutKeyPress}
                    placeholder="Inserir referências"
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                </Box>
                <Button
                  onClick={handleAddShortcut}
                  disabled={!newShortcut.trim() || shortcuts.includes(newShortcut.trim()) || permanentShortcuts.includes(newShortcut.trim()) || isSubmitting}
                >
                  Adicionar
                </Button>
              </InlineStack>

              {shortcuts.length > 0 && (
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    IDs de Produtos Temporários ({shortcuts.length})
                  </Text>
                  <InlineStack gap="100" wrap>
                    {shortcuts.map((shortcut, index) => (
                      <Tag
                        key={index}
                        onRemove={() => handleRemoveFromTemp(shortcut)}
                      >
                        {shortcut}
                      </Tag>
                    ))}
                  </InlineStack>
                  <Button
                    primary
                    onClick={handleSubmitShortcut}
                    disabled={shortcuts.length === 0 || isSubmitting}
                    loading={isSubmitting && fetcher.formData?.get("actionType") === "add"}
                  >
                    {isSubmitting && fetcher.formData?.get("actionType") === "add"
                      ? 'Submetendo...'
                      : `Submeter (${shortcuts.length} atalhos)`
                    }
                  </Button>
                </BlockStack>
              )}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">
                Lista Permanente de Atalhos ({permanentShortcuts.length})
              </Text>
              {permanentShortcuts.length === 0 && (
                <Text as="p" variant="bodyMd">Nenhum atalho salvo ainda.</Text>
              )}
              <InlineStack gap="100" wrap>
                {permanentShortcuts.map((shortcut, index) => (
                  <Tag
                    key={index}
                    onRemove={() => handleRemovePermanent(shortcut)}
                  >
                    {shortcut}
                  </Tag>
                ))}
              </InlineStack>

              <Button
                primary={permanentShortcuts.length > 0 && hasApiKey}
                onClick={handleRunSearch}
                disabled={isSearching || permanentShortcuts.length === 0 || !hasApiKey}
                loading={isSearching}
              >
                {isSearching
                  ? 'Pesquisando...'
                  : permanentShortcuts.length === 0
                    ? 'Adicione Atalhos Primeiro'
                    : !hasApiKey
                      ? 'Configure a Chave da API'
                      : 'Executar Pesquisa'
                }
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Results Modal */}
      <Modal
        open={showResultsModal}
        onClose={() => setShowResultsModal(false)}
        title="Resultados da Pesquisa"
        large
      >
        <Modal.Section>
          {searchResults ? (
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Produtos Encontrados ({searchResults.totalFound})
              </Text>

              {resultsTableRows.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'numeric', 'numeric', 'text', 'text', 'text']}
                  headings={['Referência Buscada', 'Título Produto', 'ID', 'Referência Produto', 'Código', 'Página', 'Posição', 'Imagens', 'Cores', 'Tamanhos']}
                  rows={resultsTableRows}
                  // Add row click handler
                  onRowClick={(row, index) => {
                    const originalRef = row[0]; // The first column is the searched reference
                    const productData = searchResults.found[originalRef]?.productData;
                    if (productData) {
                      handleProductRowClick(originalRef, productData);
                    }
                  }}
                />
              ) : (
                <Text as="p" variant="bodyMd">Nenhum produto encontrado para as referências buscadas.</Text>
              )}

              {notFoundList.length > 0 && (
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Referências Não Encontradas ({notFoundList.length})
                  </Text>
                  <InlineStack gap="100" wrap>
                    {notFoundList.map((ref, index) => (
                      <Tag key={index}>{ref}</Tag>
                    ))}
                  </InlineStack>
                </BlockStack>
              )}

              <Box>
                <Text as="h4" variant="headingSm">Dados JSON Completos:</Text>
                <Box
                  as="pre"
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                  style={{
                    fontSize: '12px',
                    overflow: 'auto',
                    maxHeight: '300px',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {JSON.stringify(searchResults, null, 2)}
                </Box>
              </Box>
            </BlockStack>
          ) : (
            <Text as="p" variant="bodyMd">
              Nenhum resultado de pesquisa disponível.
            </Text>
          )}
        </Modal.Section>
      </Modal>

      {/* Product Details Modal */}
      <Modal
        open={showProductDetailsModal}
        onClose={() => setShowProductDetailsModal(false)}
        title={selectedProductDetails?.title || "Detalhes do Produto"}
        large
      >
        <Modal.Section>
          {selectedProductDetails ? (
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">{selectedProductDetails.title}</Text>
              <Text as="p" variant="bodyMd">**ID:** {selectedProductDetails.id}</Text>
              <Text as="p" variant="bodyMd">**Referência:** {selectedProductDetails.reference}</Text>
              <Text as="p" variant="bodyMd">**Código:** {selectedProductDetails.code}</Text>
              <Text as="p" variant="bodyMd">**Preço:** {selectedProductDetails.price}€</Text>
              <Text as="p" variant="bodyMd">**Stock:** {selectedProductDetails.stock}</Text>
              <Text as="p" variant="bodyMd">**Descrição:** {selectedProductDetails.description || 'N/A'}</Text>

              {selectedProductDetails.images && selectedProductDetails.images.length > 0 && (
                <BlockStack gap="200">
                  <Text as="h4" variant="headingSm">Imagens do Produto:</Text>
                  <InlineStack gap="200" wrap>
                    {selectedProductDetails.images.map((imgUrl, index) => (
                      <Box key={index} width="150px" height="150px" overflow="hidden" borderRadius="100">
                        <img src={imgUrl} alt={`Product Image ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </Box>
                    ))}
                  </InlineStack>
                </BlockStack>
              )}

              {selectedProductDetails.colors && selectedProductDetails.colors.length > 0 && (
                <BlockStack gap="200">
                  <Text as="h4" variant="headingSm">Cores Disponíveis:</Text>
                  <InlineStack gap="100" wrap>
                    {selectedProductDetails.colors.map((color, index) => (
                      <Tag key={index}>{color}</Tag>
                    ))}
                  </InlineStack>
                </BlockStack>
              )}

              {selectedProductDetails.sizes && selectedProductDetails.sizes.length > 0 && (
                <BlockStack gap="200">
                  <Text as="h4" variant="headingSm">Tamanhos Disponíveis:</Text>
                  <InlineStack gap="100" wrap>
                    {selectedProductDetails.sizes.map((size, index) => (
                      <Tag key={index}>{size}</Tag>
                    ))}
                  </InlineStack>
                </BlockStack>
              )}

              {selectedProductDetails.variants && selectedProductDetails.variants.length > 0 && (
                <BlockStack gap="200">
                  <Text as="h4" variant="headingSm">Variantes:</Text>
                  <List type="bullet">
                    {selectedProductDetails.variants.map((variant, index) => (
                      <List.Item key={index}>
                        <Text as="span" variant="bodyMd">
                          **{variant.variant?.title || 'N/A'}** (Ref: {variant.variant?.reference || 'N/A'}, Code: {variant.variant?.code || 'N/A'})
                          {variant.gross_price && ` - Price: ${variant.gross_price}€`}
                          {variant.stock && ` - Stock: ${variant.stock}`}
                          {/* Display product_variants if available */}
                          {variant.product_variants && Array.isArray(variant.product_variants) && variant.product_variants.length > 0 && (
                            <List type="dash">
                                {variant.product_variants.map((pv, pvIndex) => (
                                    <List.Item key={`${index}-${pvIndex}`}>
                                        <Text as="span" variant="bodySm">
                                            {pv.text || 'N/A'} (Code: {pv.code || 'N/A'}, Barcode: {pv.barcode || 'N/A'})
                                            {pv.price && ` - Price: ${pv.price}€`}
                                            {pv.stock && Array.isArray(pv.stock) && pv.stock.length > 0 &&
                                                ` - Stock: ${pv.stock.map(s => s.qty).reduce((a, b) => a + b, 0)}` // Sum stock across stores
                                            }
                                        </Text>
                                    </List.Item>
                                ))}
                            </List>
                          )}
                        </Text>
                      </List.Item>
                    ))}
                  </List>
                </BlockStack>
              )}

              <Box>
                <Text as="h4" variant="headingSm">Dados Brutos do Produto:</Text>
                <Box
                  as="pre"
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                  style={{
                    fontSize: '12px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {JSON.stringify(selectedProductDetails, null, 2)}
                </Box>
              </Box>
            </BlockStack>
          ) : (
            <Text as="p" variant="bodyMd">
              Nenhum detalhe do produto selecionado.
            </Text>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}

function Code({ children }) {
  return (
    <Box
      as="span"
      padding="025"
      paddingInlineStart="100"
      paddingInlineEnd="100"
      background="bg-surface-active"
      borderWidth="025"
      borderColor="border"
      borderRadius="100"
    >
      <code>{children}</code>
    </Box>
  );
}
