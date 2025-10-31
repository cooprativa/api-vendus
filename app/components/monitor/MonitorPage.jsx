// app/routes/app.additional.jsx
import {
  Box,
  Card,
  Layout,
  Page,
  Text,
  BlockStack,
  Banner,
  Button,
  TextField,
  InlineStack,
  Tag,
  Modal,
  IndexTable,
  useIndexResourceState,
  Badge,
  Tabs,
  EmptyState,
  Thumbnail,
} from "@shopify/polaris";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { getSettings } from "../../services/settings.server";
import path from "path";
import { promises as fs } from "fs";
import { useState, useCallback, useMemo } from "react";
import fetch from "node-fetch";

const DATA_DIR = path.join(process.cwd(), "app", "data");
const SHORTCUTS_FILE = path.join(DATA_DIR, "shortcuts.json");
const SEARCH_RESULTS_FILE = path.join(DATA_DIR, "search_results.json");

// Helper functions
async function ensureDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error("Failed to create data directory:", error);
  }
}

async function readShortcuts() {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(SHORTCUTS_FILE, "utf-8");
    return JSON.parse(data) || [];
  } catch (error) {
    return [];
  }
}

async function writeShortcuts(shortcuts) {
  try {
    await ensureDataDirectory();
    await fs.writeFile(SHORTCUTS_FILE, JSON.stringify(shortcuts, null, 2));
    return true;
  } catch (error) {
    throw error;
  }
}

export async function loader() {
  const vendusApi = getVendusApi();
  let permanentShortcuts = await readShortcuts();
  let searchResults = null;

  // Load search results
  try {
    const resultsRaw = await fs.readFile(SEARCH_RESULTS_FILE, "utf-8");
    searchResults = JSON.parse(resultsRaw);
  } catch (error) {
    searchResults = null;
  }

  return json({
    hasApiKey: !!vendusApi,
    permanentShortcuts,
    searchResults,
  });
}

export async function action({ request }) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "add") {
    try {
      const shortcutsToAdd = JSON.parse(formData.get("shortcuts"));
      const existingShortcuts = await readShortcuts();
      const newShortcuts = shortcutsToAdd.filter(s => !existingShortcuts.includes(s));
      const updatedShortcuts = [...existingShortcuts, ...newShortcuts];

      await writeShortcuts(updatedShortcuts);

      return json({
        success: true,
        message: `Added ${newShortcuts.length} new product references`,
      });
    } catch (error) {
      return json({ error: `Failed to add product references: ${error.message}` });
    }
  }

  if (actionType === "remove") {
    try {
      const shortcutToRemove = formData.get("shortcut");
      const existingShortcuts = await readShortcuts();
      const updatedShortcuts = existingShortcuts.filter(s => s !== shortcutToRemove);

      await writeShortcuts(updatedShortcuts);

      return json({
        success: true,
        message: `Removed product reference: ${shortcutToRemove}`,
      });
    } catch (error) {
      return json({ error: `Failed to remove product reference: ${error.message}` });
    }
  }

  if (actionType === "search") {
    try {
      const vendusApi = getVendusApi();
      const permanentShortcuts = await readShortcuts();

      if (!vendusApi || permanentShortcuts.length === 0) {
        return json({ error: "API key not configured or no product references to search" });
      }

      const searchResults = await runSearchScript(permanentShortcuts, vendusApi);
      await fs.writeFile(SEARCH_RESULTS_FILE, JSON.stringify(searchResults, null, 2));

      return json({ success: true, searchResults });
    } catch (error) {
      return json({ error: `Product search failed: ${error.message}` });
    }
  }

  return json({ error: "Unknown action type" });
}

// Simplified search function
async function runSearchScript(refs, apiKey) {
  const URL = "https://www.vendus.pt/ws/v1.1/products";

  // Simplified API client
  const fetchProducts = async (page) => {
    const response = await fetch(`${URL}?page=${page}&per_page=100`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  };

  const foundRefs = new Map();
  const remainingRefs = new Set(refs);
  let currentPage = 1;
  const maxPages = 100; // Reasonable limit

  while (remainingRefs.size > 0 && currentPage <= maxPages) {
    try {
      const products = await fetchProducts(currentPage);

      if (!Array.isArray(products) || products.length === 0) break;

      products.forEach((product, index) => {
        refs.forEach(ref => {
          if (product.reference === ref || product.code === ref || product.id?.toString() === ref) {
            foundRefs.set(ref, {
              page: currentPage,
              position: index + 1,
              productData: {
                id: product.id,
                title: product.title,
                reference: product.reference,
                code: product.code,
                price: product.price,
                stock: product.stock
              }
            });
            remainingRefs.delete(ref);
          }
        });
      });

      if (products.length < 100) break; // Last page
      currentPage++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error fetching page ${currentPage}:`, error);
      break;
    }
  }

  return {
    searchDate: new Date().toISOString(),
    totalSearched: refs.length,
    totalFound: foundRefs.size,
    found: Object.fromEntries(foundRefs),
    notFound: Array.from(remainingRefs)
  };
}

export default function ProductsPage() {
  const { hasApiKey, permanentShortcuts, searchResults } = useLoaderData();
  const fetcher = useFetcher();

  const [shortcuts, setShortcuts] = useState([]);
  const [newShortcut, setNewShortcut] = useState("");
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [queryValue, setQueryValue] = useState('');

  const isSearching = fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "search";
  const isSubmitting = fetcher.state === "submitting";

  // Transform search results into products
  const products = useMemo(() => {
    if (!searchResults?.found) return [];

    return Object.entries(searchResults.found).map(([ref, data]) => ({
      id: data.productData.id || ref,
      title: data.productData.title || `Product ${ref}`,
      reference: ref,
      code: data.productData.code || ref,
      price: data.productData.price ? `€${data.productData.price}` : 'N/A',
      stock: data.productData.stock || 0,
      status: data.productData.stock > 0 ? 'Active' : 'Out of stock',
    }));
  }, [searchResults]);

  const resourceName = { singular: 'product', plural: 'products' };
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(products);

  // Event handlers
  const handleAddShortcut = useCallback(() => {
    const trimmed = newShortcut.trim();
    if (!trimmed || shortcuts.includes(trimmed) || permanentShortcuts.includes(trimmed)) return;

    setShortcuts(prev => [...prev, trimmed]);
    setNewShortcut("");
  }, [newShortcut, shortcuts, permanentShortcuts]);

  const handleSubmitShortcuts = useCallback(() => {
    if (shortcuts.length === 0) return;

    const formData = new FormData();
    formData.append("actionType", "add");
    formData.append("shortcuts", JSON.stringify(shortcuts));
    fetcher.submit(formData, { method: "post" });

    setShortcuts([]);
  }, [shortcuts, fetcher]);

  const handleRemoveShortcut = useCallback((shortcut) => {
    const formData = new FormData();
    formData.append("actionType", "remove");
    formData.append("shortcut", shortcut);
    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);

  const handleSearch = useCallback(() => {
    const formData = new FormData();
    formData.append("actionType", "search");
    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);

  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(queryValue.toLowerCase()) ||
    product.reference.toLowerCase().includes(queryValue.toLowerCase())
  );

  const tabs = [
    { id: 'products', content: 'Products', panelID: 'products-panel' },
    { id: 'references', content: 'References', panelID: 'references-panel' }
  ];

  return (
    <Page
      title="Products"
      primaryAction={{
        content: 'Sync Products',
        onAction: handleSearch,
        loading: isSearching,
        disabled: permanentShortcuts.length === 0 || !hasApiKey
      }}
    >
      <Layout>
        <Layout.Section>
          {/* Status Banners */}
          {!hasApiKey && (
            <Banner status="warning">
              <p>Connect to Vendus API to sync products. Configure your API key in Settings.</p>
            </Banner>
          )}

          {fetcher.data?.success && (
            <Banner status="success">
              <p>{fetcher.data.message}</p>
            </Banner>
          )}

          {fetcher.data?.error && (
            <Banner status="critical">
              <p>{fetcher.data.error}</p>
            </Banner>
          )}

          <Card>
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
              {/* Products Tab */}
              {selectedTab === 0 && (
                <Card.Section>
                  {products.length > 0 ? (
                    <BlockStack gap="400">
                      <InlineStack align="space-between">
                        <Text variant="headingMd">{products.length} products</Text>
                        <TextField
                          placeholder="Search products..."
                          value={queryValue}
                          onChange={setQueryValue}
                          clearButton
                          onClearButtonClick={() => setQueryValue('')}
                        />
                      </InlineStack>

                      <IndexTable
                        resourceName={resourceName}
                        itemCount={filteredProducts.length}
                        selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
                        onSelectionChange={handleSelectionChange}
                        headings={[
                          { title: 'Product' },
                          { title: 'Reference' },
                          { title: 'Price' },
                          { title: 'Stock' },
                          { title: 'Status' },
                        ]}
                      >
                        {filteredProducts.map((product, index) => (
                          <IndexTable.Row
                            id={product.id}
                            key={product.id}
                            selected={selectedResources.includes(product.id)}
                            position={index}
                          >
                            <IndexTable.Cell>
                              <InlineStack gap="300">
                                <Thumbnail
                                  source="https://via.placeholder.com/40x40/e1e5e9/333.png?text=P"
                                  alt={product.title}
                                  size="small"
                                />
                                <Text variant="bodyMd" fontWeight="bold">
                                  {product.title}
                                </Text>
                              </InlineStack>
                            </IndexTable.Cell>
                            <IndexTable.Cell>{product.reference}</IndexTable.Cell>
                            <IndexTable.Cell>{product.price}</IndexTable.Cell>
                            <IndexTable.Cell>{product.stock}</IndexTable.Cell>
                            <IndexTable.Cell>
                              <Badge status={product.status === 'Active' ? 'success' : 'critical'}>
                                {product.status}
                              </Badge>
                            </IndexTable.Cell>
                          </IndexTable.Row>
                        ))}
                      </IndexTable>
                    </BlockStack>
                  ) : (
                    <EmptyState
                      heading="No products synced yet"
                      action={{
                        content: 'Add Product References',
                        onAction: () => setSelectedTab(1)
                      }}
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Add product references and sync with Vendus to start managing your inventory.</p>
                    </EmptyState>
                  )}
                </Card.Section>
              )}

              {/* References Tab */}
              {selectedTab === 1 && (
                <Card.Section>
                  <BlockStack gap="500">
                    {/* Add References */}
                    <Card>
                      <Card.Section>
                        <BlockStack gap="400">
                          <Text variant="headingMd">Add Product References</Text>
                          <InlineStack gap="200" align="end">
                            <Box style={{ flexGrow: 1 }}>
                              <TextField
                                label="Product Reference"
                                value={newShortcut}
                                onChange={setNewShortcut}
                                placeholder="Enter SKU, ID, or reference"
                                onKeyPress={(e) => e.key === 'Enter' && handleAddShortcut()}
                                disabled={isSubmitting}
                              />
                            </Box>
                            <Button onClick={handleAddShortcut} disabled={!newShortcut.trim() || isSubmitting}>
                              Add
                            </Button>
                          </InlineStack>

                          {shortcuts.length > 0 && (
                            <BlockStack gap="200">
                              <Text variant="headingSm">Pending ({shortcuts.length})</Text>
                              <InlineStack gap="100" wrap>
                                {shortcuts.map((shortcut, index) => (
                                  <Tag key={index} onRemove={() => setShortcuts(prev => prev.filter(s => s !== shortcut))}>
                                    {shortcut}
                                  </Tag>
                                ))}
                              </InlineStack>
                              <Button
                                primary
                                onClick={handleSubmitShortcuts}
                                loading={isSubmitting && fetcher.formData?.get("actionType") === "add"}
                              >
                                Save {shortcuts.length} Reference{shortcuts.length > 1 ? 's' : ''}
                              </Button>
                            </BlockStack>
                          )}
                        </BlockStack>
                      </Card.Section>
                    </Card>

                    {/* Saved References */}
                    <Card>
                      <Card.Section>
                        <BlockStack gap="400">
                          <InlineStack align="space-between">
                            <Text variant="headingMd">Saved References ({permanentShortcuts.length})</Text>
                            <Button
                              primary
                              onClick={handleSearch}
                              disabled={isSearching || permanentShortcuts.length === 0 || !hasApiKey}
                              loading={isSearching}
                            >
                              {isSearching ? 'Syncing...' : 'Sync Products'}
                            </Button>
                          </InlineStack>

                          {permanentShortcuts.length === 0 ? (
                            <EmptyState
                              heading="No references saved"
                              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                            >
                              <p>Add your first product reference to get started.</p>
                            </EmptyState>
                          ) : (
                            <InlineStack gap="100" wrap>
                              {permanentShortcuts.map((shortcut, index) => (
                                <Tag key={index} onRemove={() => handleRemoveShortcut(shortcut)}>
                                  {shortcut}
                                </Tag>
                              ))}
                            </InlineStack>
                          )}
                        </BlockStack>
                      </Card.Section>
                    </Card>

                    {/* Last Sync Results */}
                    {searchResults && (
                      <Card>
                        <Card.Section>
                          <BlockStack gap="300">
                            <InlineStack align="space-between">
                              <Text variant="headingMd">Last Sync Results</Text>
                              <Button onClick={() => setShowResultsModal(true)} plain>
                                View Details
                              </Button>
                            </InlineStack>
                            <Text>Synced: {new Date(searchResults.searchDate).toLocaleString()}</Text>
                            <InlineStack gap="200">
                              <Badge status="success">{searchResults.totalFound} Found</Badge>
                              {searchResults.notFound?.length > 0 && (
                                <Badge status="attention">{searchResults.notFound.length} Not Found</Badge>
                              )}
                            </InlineStack>
                          </BlockStack>
                        </Card.Section>
                      </Card>
                    )}
                  </BlockStack>
                </Card.Section>
              )}
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Results Modal */}
      <Modal
        open={showResultsModal}
        onClose={() => setShowResultsModal(false)}
        title="Sync Results"
        primaryAction={{ content: 'Close', onAction: () => setShowResultsModal(false) }}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text>
              Searched {searchResults?.totalSearched || 0} references, found {searchResults?.totalFound || 0}.
            </Text>

            {searchResults?.notFound?.length > 0 && (
              <BlockStack gap="200">
                <Text variant="headingSm" tone="critical">Not Found References:</Text>
                <InlineStack gap="100" wrap>
                  {searchResults.notFound.map((ref, index) => (
                    <Tag key={index}>{ref}</Tag>
                  ))}
                </InlineStack>
              </BlockStack>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
