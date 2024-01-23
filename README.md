# Shift4 Cartridge for Salesforce B2C

[Shift4](https://www.shift4.com/) is a payment processor. This cartridge enables B2C merchants to use Shift4 as their payment provider for the following payment methods:

-   Credit/Debit Card
-   Apple Pay

## Prerequisites

-   Ensure you have [Node.js](https://nodejs.org/en/download) installed on your system.

## Deployment

1. Execute this command in a terminal to install all dependencies, connect to your B2C instance, and upload the cartridges to your B2C instance:

```sh
npm install

# You will be prompted for your B2C credentials; have them ready to go
```

2. Follow the instructions outlined in the [installation & configuration guide](https://docs.google.com/document/d/1m-aWBQL6PtzE4fIgOxH7cunJb5TaDIXqFAksUs27OXA/view) to complete the installation.

## Additional Commands

```sh
# Change your B2C user / instance / code version
npm run configure
```

```sh
# Re-upload all Shift4 cartridges to your B2C instance
npm run uploadCartridge
```

## Development

Please see the [developer guide](https://docs.google.com/document/d/1LaO-Rp9kBsUwJL1IU7YvKgG2S1IFqy4-a1w7_jhaa8U/view) for data models, feature flows, and other information.
