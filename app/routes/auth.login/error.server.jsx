export function loginErrorMessage(loginErrors) {
  if (loginErrors?.shop === "MissingShop") {
    return { shop: "Please enter your shop domain to log in" };
  } else if (loginErrors?.shop === "InvalidShop") {
    return { shop: "Please enter a valid shop domain to log in" };
  }

  return {};
}