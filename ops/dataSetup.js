require('dotenv').config();
const fs = require('fs');
const restController = require('./utils/salesforceRestController');
const sfOrgUsername = process.env.DATA_SETUP_SF_ORG_USERNAME;
const sfOrgPassword = process.env.DATA_SETUP_SF_ORG_PASSWORD;
const loginUrl = process.env.DATA_SETUP_SF_ORG_LOGIN_URL;
const clientId = process.env.DATA_SETUP_SF_ORG_CLIENT_ID;
const clientSecret = process.env.DATA_SETUP_SF_ORG_CLIENT_SECRET;

exports.createAccountRecordsViaAPI = async () => {

    let credentials = {
        "username" : sfOrgUsername,
        "password" : sfOrgPassword,
        "login_url" : loginUrl,
        "client_id" : clientId,
        "client_secret" : clientSecret
    };

    const accessKeyPair = await restController.getAccessKeyPair(credentials);
    let recordId;
    try {
        let jsonData = JSON.parse(fs.readFileSync(`./testData/account.json`));

        for(var i = 0; i < jsonData.length; i++)
        {
            console.log(jsonData[i]);
            console.log(`Create record payload is ${JSON.stringify(jsonData[i])}`);
            let responseData = await restController.createRecord(accessKeyPair, jsonData[i], "Account");
            console.log(`Creation successful! ${JSON.stringify(responseData)}`);
        }
    } catch (e) {
        console.log(`Failed to create records.` + e);
    }
    return recordId;
};

exports.setUpOrgData = async () => {
    let credentials = {
        "username" : sfOrgUsername,
        "password" : sfOrgPassword,
        "login_url" : loginUrl,
        "client_id" : clientId,
        "client_secret" : clientSecret
    };

    const accessKeyPair = await restController.getAccessKeyPair(credentials);
    let responseData;
    try {
        let jsonData = JSON.parse(fs.readFileSync(`${__dirname}/testData/dataGraph.json`));
        console.log("Insert Data to org through composite graph");
        responseData = await restController.insertViaDataGraph(accessKeyPair, jsonData);
        console.log(responseData);
    } catch (e) {
        console.log(`Failed to create records.` + e);
    }
    return responseData;
};

exports.setUpOrgData();