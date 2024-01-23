#!/usr/bin/env node
/** @format */

'use strict';
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const cli = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

const SGFM_BIN = path.resolve(__dirname, '../node_modules', '.bin', 'sgmf-scripts');
const CARTRIDGES_DIR = path.resolve(__dirname, '../cartridges');
const DW_FILE = path.resolve(__dirname, '../dw.json');
const METADATA_DIR = path.resolve(__dirname, '../metadata');
const SITES_METADATA_DIR = path.resolve(METADATA_DIR, 'sites');

const timeouts = new Set();
function setTimeoutInternal(callback, waitTime) {
    const timeout = setTimeout(callback, waitTime);
    timeouts.add(timeout);
    return timeout;
}
function clearTimeoutInternal(timeout) {
    timeouts.delete(timeout);
    clearTimeout(timeout);
}

/**
 * Exit the current process
 * @param {string} message
 * @param {number} status
 */
function exit(status = 1, message = 'Exiting') {
    timeouts.forEach((timeout) => clearTimeoutInternal(timeout));
    console.log(`\n${message}\n`);
    process.exit(status);
}

/**
 * Prompt the user for a value in the cli
 * @param {string} query - Prompt for the user to read
 * @param {boolean} silent - Whether to silent the
 * @param {number} timeout - Milliseconds to wait before timing out
 * @returns {Promise<string>}
 */
async function prompt(query, silent = false, timeout = 60000) {
    const promptTimeout = setTimeoutInternal(
        () => exit(1, `Read timed out after ${timeout / 1000} seconds of inactivity.`),
        timeout
    );
    return new Promise((resolve) => {
        cli.question(query, (value) => {
            cli._writeToOutput = (str) => cli.output.write(str);
            if (silent) {
                console.log('');
            }
            clearTimeoutInternal(promptTimeout);
            resolve(value || '');
        });
        cli._writeToOutput = (str) => cli.output.write(silent ? '*' : str);
    });
}

/**
 * @description Prompt the user for a boolean value in the cli
 * @param {string} query - Prompt for the user to read
 * @param {boolean} defaultValue - Default value to return if the user does not enter a value
 * @param {number} timeout - Milliseconds to wait before timing out
 * @returns {Promise<boolean>}
 */
async function promptBoolean(query, defaultValue, timeout = 30000) {
    let response;
    while (response !== 'Y' && response !== 'N') {
        response = (await prompt(query, false, timeout)).toUpperCase();
        if (typeof defaultValue === 'boolean' && !response?.length) {
            return defaultValue;
        }
    }
    return response === 'Y';
}

/**
 * ----------------------------------------------
 *               MAIN FUNCTION
 * ----------------------------------------------
 */
(async () => {
    if (!fs.existsSync(SGFM_BIN)) {
        return exit(
            1,
            'node-modules not found. Please re-run this script after installing dependencies with `npm install --include=dev --legacy-peer-deps`'
        );
    }

    const DWExists = fs.existsSync(DW_FILE);
    let promptDW = !DWExists;
    let dw = {};
    if (DWExists) {
        dw = require(DW_FILE);
        console.info('Demandware Instance Info:');
        console.info(' - Hostname:', dw.hostname);
        console.info(' - Username:', dw.username);
        console.info(' - Password:', dw.password.replace(/./g, '*'));
        console.info(' - Code Version: ', dw['code-version']);
        console.info('');
        promptDW = await promptBoolean('Would you like to change the Demandware instance info? (y/N): ', false);
    } else {
        console.warn('WARNING | Could not find dw.json file. Please follow the prompts to create one.');
    }

    if (promptDW) {
        let hostname = '';
        while (!hostname?.length) {
            const defaultPrompt = dw.hostname ? ` (default=${dw.hostname})` : '';
            hostname = (await prompt(`Demandware Instance Hostname${defaultPrompt}: `)) || dw.hostname;
        }

        let username = '';
        while (!username?.length) {
            const defaultPrompt = dw.username ? ` (default=${dw.username})` : '';
            username = (await prompt(`Demandware Username${defaultPrompt}: `)) || dw.username;
        }

        let password = '';
        while (!password?.length) {
            const defaultPrompt = dw.password ? ` (default=****)` : '';
            password = (await prompt(`Demandware Password${defaultPrompt}: `, true)) || dw.password;
        }

        console.log(
            'Please go to Administration > Site Development > Code Deployment and ensure that the value you will use here is the active code version for your B2C instance.'
        );
        const codeVersion =
            (await prompt(`Code Version (default=${dw['code-version'] ?? 'SFRA_UPC_11_17_2022'}): `)) ||
            'SFRA_UPC_11_17_2022';

        dw = {
            hostname,
            username,
            password,
            'code-version': codeVersion,
            cartridgesPath: fs
                .readdirSync(CARTRIDGES_DIR)
                .filter((file) => fs.lstatSync(path.resolve(CARTRIDGES_DIR, file)).isDirectory())
                .join(':')
        };

        fs.writeFileSync(DW_FILE, JSON.stringify(dw, null, 4));
    }

    // If the ./metadata/sites directory does not exist, throw an error and exit
    if (!fs.existsSync(SITES_METADATA_DIR)) {
        console.error('ERROR | Could not find directory:', SITES_METADATA_DIR);
        console.error(
            'ERROR | Please ensure that the metadata directory is in the root directory of this cartridge pack.'
        );
        console.error(
            'ERROR | If you are missing the metadata directory, please re-download this cartridge pack and try again.'
        );
        return exit(1);
    }

    const currentSiteNames = fs
        .readdirSync(SITES_METADATA_DIR)
        .filter((filename) => fs.lstatSync(path.resolve(SITES_METADATA_DIR, filename)).isDirectory());

    let siteNames = Object.assign([], currentSiteNames);

    console.info('');
    console.info('Target sites for deployment:');
    siteNames.forEach((siteName) => console.info(' - ', siteName));
    console.info('');

    let sitesConfirmed = !(await promptBoolean(
        'Would you like to change the target deployment sites? (y/N): ',
        false,
        30000
    ));
    console.info('');

    while (!sitesConfirmed) {
        siteNames = [];
        while (true) {
            const defaultOptionPrompt = siteNames.length ? '(leave blank to continue)' : '(default=RefArch)';
            const siteName = await prompt(`Site Name ${defaultOptionPrompt}: `);
            if (!siteName?.length) {
                if (siteNames.length) {
                    break;
                } else {
                    siteNames.push('RefArch');
                }
            } else {
                siteNames.push(siteName);
            }
        }
        console.info('');
        console.info('Target sites for deployment:');
        siteNames.forEach((siteName) => console.info(' - ', siteName));
        console.info('');
        sitesConfirmed = await promptBoolean('Is this ok? (Y/n): ', true, 30000);
        console.info('');
    }

    console.info('Creating site metadata folders for selected site names...');

    // Remove all but 1 site from the metadata directory
    while (currentSiteNames.length > 1) {
        fs.rmdirSync(path.resolve(SITES_METADATA_DIR, currentSiteNames.pop()), { recursive: true });
    }

    // Rename the remaining site to the first site in the list
    const referenceSitePath = path.resolve(SITES_METADATA_DIR, siteNames.shift());
    fs.renameSync(path.resolve(SITES_METADATA_DIR, currentSiteNames[0]), referenceSitePath);

    // Copy the remaining site to the other sites in the list
    siteNames.forEach((siteName) => {
        fs.cpSync(referenceSitePath, path.resolve(SITES_METADATA_DIR, siteName), { recursive: true });
    });

    console.info('Zipping metadata directory...');

    // Zip the metadata sites directory
    try {
        fs.rmSync(path.resolve(__dirname, 'metadata.zip'), { force: true });
        const archive = archiver('zip');
        const metadataZipWriteStream = fs.createWriteStream('metadata.zip');
        const streamPromise = new Promise((resolve, reject) => {
            metadataZipWriteStream.on('close', resolve);
            archive.on('error', reject);
        });
        archive.pipe(metadataZipWriteStream);
        for (const fileName of fs.readdirSync(SITES_METADATA_DIR)) {
            const filePath = path.resolve(SITES_METADATA_DIR, fileName);
            if (fs.lstatSync(filePath).isDirectory()) {
                archive.directory(filePath, `metadata/sites/${fileName}`);
            }
        }
        const archivePromise = archive.finalize();
        await Promise.all([streamPromise, archivePromise]);
        console.info('Zipped metadata successfully!');
    } catch (error) {
        console.error('Failed to zip metadata directory');
        console.error(error);
        return exit(1);
    }

    exit(0, 'Done. Please follow the instructions in the README.md file to complete the installation.');
})();
