import {
  Box,
  Card,
  Layout,
  Page,
  Text,
  BlockStack,
  TextField,
  useBreakpoints,
  Button,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { useEffect, useState } from "react";
import { promises as fs } from "fs";
import path from "path";

const ENV_FILE = path.join(process.cwd(), ".env");

export async function loader() {
  // Read current API key from environment
  const currentApiKey = process.env.Chave_de_API_vendus || "";

  return json({
    vendusApi: currentApiKey,
    lastUpdated: null
  });
}

export async function action({ request }) {
  const formData = await request.formData();
  const vendusApi = formData.get("vendusApi");

  try {
    // Validate API key format
    if (!vendusApi || vendusApi.trim().length < 10) {
      return json({
        error: "API key must be at least 10 characters long"
      }, { status: 400 });
    }

    // Read current .env file
    let envContent = "";
    try {
      envContent = await fs.readFile(ENV_FILE, "utf-8");
    } catch (error) {
      // If .env doesn't exist, create it
      envContent = "";
    }

    const newApiKey = vendusApi.trim();

    // Check if Chave_de_API_vendus already exists in the file
    if (envContent.includes("Chave_de_API_vendus=")) {
      // Replace existing value
      envContent = envContent.replace(
        /Chave_de_API_vendus=.*/g,
        `Chave_de_API_vendus=${newApiKey}`
      );
    } else {
      // Add new line if file doesn't end with newline
      if (envContent && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      // Append new environment variable
      envContent += `Chave_de_API_vendus=${newApiKey}\n`;
    }

    // Write back to .env file
    await fs.writeFile(ENV_FILE, envContent);

    console.log("API key saved to .env file");

    return json({
      success: true,
      vendusApi: newApiKey,
      message: "API key saved to environment file. Please restart your server to apply changes."
    });
  } catch (error) {
    console.error("Error saving to .env file:", error);
    return json({
      error: "Failed to save API key to environment file. Please try again."
    }, { status: 500 });
  }
}

export default function SettingsPage() {
  const settings = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const { smUp } = useBreakpoints();

  const [vendusApi, setVendusApi] = useState("");

  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.success) {
      setVendusApi("");
    }
  }, [actionData]);

  const lastSaved = actionData?.vendusApi || settings.vendusApi || "Insert your Vendus API";

  return (
    <Page
      divider
      primaryAction={{ content: "View on your store", disabled: true }}
      secondaryActions={[
        {
          content: "Duplicate",
          onAction: () => alert("Duplicate action"),
        },
      ]}
    >
      <TitleBar title="Settings" />
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <Form method="post">
              <BlockStack gap={{ xs: "800", sm: "400" }}>
                <Text as="h3" variant="headingMd">
                  Configuration
                </Text>
                <Text as="p" variant="bodyMd">
                  Configure your Vendus API below
                </Text>

                {actionData?.error && (
                  <Banner status="critical">
                    <p>{actionData.error}</p>
                  </Banner>
                )}

                <TextField
                  label="Configure Vendus"
                  placeholder={lastSaved}
                  name="vendusApi"
                  value={vendusApi}
                  onChange={setVendusApi}
                  autoComplete="off"
                  type="password"
                  helpText="Your API key will be stored securely"
                  disabled={isSubmitting}
                />

                <Button
                  primary
                  submit
                  loading={isSubmitting}
                  disabled={!vendusApi.trim()}
                >
                  {isSubmitting ? "Saving..." : "Save"}
                </Button>

                {actionData?.success && (
                  <Banner status="success">
                    <p>{actionData.message || "API key saved successfully!"}</p>
                  </Banner>
                )}

                {settings.lastUpdated && (
                  <Text as="p" variant="bodySm" tone="subdued">
                    Last updated: {new Date(settings.lastUpdated).toLocaleString()}
                  </Text>
                )}
              </BlockStack>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
