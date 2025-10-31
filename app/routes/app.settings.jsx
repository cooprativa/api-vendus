// app/routes/app.settings.jsx
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
import { getSettings, updateSettings } from "../services/settings.server";

export async function loader() {
  return json(getSettings());
}

export async function action({ request }) {
  const formData = await request.formData();
  const vendusApi = formData.get("vendusApi");

  try {
    if (!vendusApi || vendusApi.trim().length < 10) {
      return json({
        error: "API key must be at least 10 characters long"
      }, { status: 400 });
    }

    const updatedSettings = updateSettings({
      vendusApi: vendusApi.trim(),
      lastUpdated: new Date().toISOString()
    });

    console.log("Settings updated:", updatedSettings);

    return json({ success: true, vendusApi: updatedSettings.vendusApi });
  } catch (error) {
    console.error("Error saving settings:", error);
    return json({
      error: "Failed to save settings. Please try again."
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
                  Configuração
                </Text>
                <Text as="p" variant="bodyMd">
                  Configure a API do Vendus abaixo
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
                  helpText="Sua chave de API vai ser guardada com segurança."
                  disabled={isSubmitting}
                />

                <Button
                  primary
                  submit
                  loading={isSubmitting}
                  disabled={!vendusApi.trim()}
                >
                  {isSubmitting ? "Salvando..." : "Configuração salva"}
                </Button>

                {actionData?.success && (
                  <Banner status="success">
                    <p>API key saved successfully!</p>
                  </Banner>
                )}

                {settings.lastUpdated && (
                  <Text as="p" variant="bodySm" tone="subdued">
                    Ultima atualização: {new Date(settings.lastUpdated).toLocaleString()}
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
