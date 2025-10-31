import { useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import stylesUrl from "../styles.module.css";

export const links = () => [{ rel: "stylesheet", href: stylesUrl }];

import {
  Page,
  Layout,
  Card,
  BlockStack,
  Image, // Import the Image component from Polaris
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

// We can remove the 'action' export if it's no longer used,
// as the "Generate a product" button (which triggered it) is being removed.
// However, I'll keep it for now, as you might have other uses for it later.
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );
  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants,
  };
};

export default function Index() {
  const fetcher = useFetcher(); // fetcher is still here but not used for generating products directly now
  const shopify = useAppBridge();
  const productId = fetcher.data?.product?.id.replace(
    "gid://shopify/Product/",
    "",
  );

  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);

  // Removed the generateProduct function as the button is gone
  // const generateProduct = () => fetcher.submit({}, { method: "POST" });

  return (
    <Page fullWidth>
      <TitleBar title="Vendus API Manager">
        {/* The "Generate a product" button has been completely removed from here */}
      </TitleBar>
      <BlockStack gap="700">
        <Layout>
          <Layout.Section>
            <Card sectioned>
              {/* Using Polaris Image component for better styling and accessibility */}
              {/* Make sure the image path is correct relative to your public folder */}
              <Image
                source="../app/images/logo_cooprativa.png" // Correct path if in public/images
                alt="Logo Cooperativa"
                width={150} // Example: set a width
                height={150} // Example: set a height
                style={{ display: 'block', margin: '0 auto', borderRadius: '100%' }} // Center the image
              />

              <p style={{ textAlign: 'center', marginTop: '20px' }}>
                Welcome to Vendus API Manager.
              </p>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
