//this script is used to execute testson STA V3

const axios = require('axios');
const { getCurrentDateTimeString } = require('./utils/dataController');
exports.sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const serviceUrl = process.env.V3_SERVICE_URL;
const serviceUsername = process.env.V3_SERVICE_USERNAME;
const servicePassword = process.env.V3_SERVICE_PASSWORD;
const clientId = process.env.V3_CLIENT_ID;
const testOrTestSuiteId = process.env.V3_TEST_OR_TESTSUITE_ID;
const environmentId = process.env.V3_ENVIRONMENT_ID;
const browser = process.env.V3_BROWSER;
const loginUrl = process.env.V3_LOGIN_URL;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const isConfigured = () => {
    if ( typeof serviceUrl === "undefined" || serviceUrl.length === 0 ||
            typeof serviceUsername === "undefined" || serviceUsername.length === 0 ||
            typeof servicePassword === "undefined" || servicePassword.length === 0 ||
            typeof clientId === "undefined" || clientId.length === 0 ||
            typeof testOrTestSuiteId === "undefined" || testOrTestSuiteId.length === 0 ||
            typeof environmentId === "undefined" || environmentId.length === 0 ||
            typeof browser === "undefined" || browser.length === 0 ||
            typeof loginUrl === "undefined" || loginUrl.length === 0 ) {
        throw new Error(`Error: critical environment settings required. { V3_SERVICE_URL, V3_SERVICE_USERNAME, V3_SERVICE_PASSWORD,
            V3_CLIENT_ID, V3_TEST_OR_TESTSUITE_ID, V3_ENVIRONMENT_ID, V3_BROWSER, V3_LOGIN_URL }`);
    }
}

exports.login = async () => {
    let response;

    try {
        response = await axios.post(
            `${serviceUrl}/auth/api/public/user/login`,
            {
                username: serviceUsername,
                password: servicePassword
            }
        );
    } catch (e) {
        throw new Error(`Error: login. ${e.stack}`);
    }

    return response.data;
}

exports.createandinsert = async (token, data) => {
    let response;

    try {
        response = await axios.post(
            `${serviceUrl}/${clientId}/serv/api/testresult/createandinsert`,
            data,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );

    } catch (e) {
        throw new Error(`Error: create. ${e.response.data} - ${e.stack}`);
    }

    return response;
}

exports.execute = async () => {

    isConfigured();

    let authResponse = await exports.login();
    let _id = authResponse._id;
    let token = authResponse.token;

    let testData = {
        "name": testOrTestSuiteId + "_" + await getCurrentDateTimeString(),
        "_testId": testOrTestSuiteId,
        "_environmentId": environmentId,
        "browser": browser,
        "login_url": loginUrl,
        "_ownerId": _id
    };

    let testResponse = await exports.createandinsert(token, testData);
    console.log(testResponse);
}

exports.execute();
