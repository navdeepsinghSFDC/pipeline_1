//this script is used to execute testson STA V2
require('dotenv').config();
const { getCurrentDateTimeString } = require('./utils/dataController');
const restController = require('./utils/salesforceRestController.js');

const suiteId = process.env.V2_SUITE_ID;
const acceptanceCriteria = process.env.V2_ACCEPTANCE_CRITERIA ? [...new Set(process.env.V2_ACCEPTANCE_CRITERIA.split(`,`))] : null;
const automationOrgUsername = process.env.V2_ORG_USERNAME;
const automationOrgPassword = process.env.V2_ORG_PASSWORD;
const automationOrgLoginUrl = process.env.V2_ORG_LOGIN_URL;
const automationOrgClientId = process.env.V2_ORG_CLIENT_ID;
const automationOrgClientSecret = process.env.V2_ORG_CLIENT_SECRET;

const data = {
    "TestSuite": {
        "objectName": "Test_Suite__c",
        "metaData": {
            "SuiteType__c": "TestSuite"
        }
    },
    "TestSuiteLineItem": {
        "objectName": "Test_Suite_Line_Item__c",
        "metaData": []
    }
};

exports.sta_v2_executeTest = async () => {

    let recordId;
    let testSuite = {};
    let testSuiteLineItems = data.TestSuiteLineItem;
    let IntegrationSuite = {};
    let IntegrationLineItems = data.TestSuiteLineItem;

    let testRundata = {};
    testRundata.objectName = "Test_Run__c";
    testRundata.recordData = {};

    const credentials = {
        "username" : automationOrgUsername,
        "password" : automationOrgPassword,
        "login_url" : automationOrgLoginUrl,
        "client_id" : automationOrgClientId,
        "client_secret" : automationOrgClientSecret
    };

    const accessKeyPair = await restController.getAccessKeyPair(credentials);
    const currentDate = await getCurrentDateTimeString();

    try {
        if (typeof suiteId === "undefined" || suiteId.toLowerCase() === "na") {
            //Step - 1 : Fetch all the Relevant Tests
            let testIds = [];
            let acceptanceQuery = `SELECT Id, Name, Acceptance_Criteria__c FROM Test__c where Approved__c=TRUE and Acceptance_Criteria__c != NULL and Type__c includes ('Acceptance')`;
            let acceptanceTests = await restController.query(accessKeyPair, acceptanceQuery);

            let integrationQuery = `SELECT Id, Name, Acceptance_Criteria__c FROM Test__c where Approved__c=TRUE and Type__c includes ('Integration')`;
            let integrationTests = await restController.query(accessKeyPair, integrationQuery);

            if (acceptanceTests.length > 0) {
                acceptanceTests.forEach(test => {
                    if(acceptanceCriteria !== null && typeof acceptanceCriteria !== "undefined" && Array.isArray(acceptanceCriteria)) {
                        if(acceptanceCriteria.includes(test.Acceptance_Criteria__c)) {
                            testIds.push(test.Id);
                        }
                    } else {
                        testIds.push(test.Id);
                    }
                });                    
            } else {
                throw new Error(`Error: No Acceptance tests found in STA org.`);
            }
            
            //Step - 2 : Creation of Test Suite Record
            let suiteData = data.TestSuite;
            const automationSuiteName = `Acceptance-Suite-${currentDate}`;
            suiteData.metaData.Name = automationSuiteName;
            suiteData.metaData.Description__c = 'Test-Automation-Description';
            testSuite = await restController.createRecord(accessKeyPair, suiteData.metaData, suiteData.objectName);
            testSuite.Name = automationSuiteName;
            testSuite.Id = testSuite.id;

            
            
            //Step - 3 : Add Tests to TestSuite as Test_Suite_Line_Item__c
            for (var i = 0; i < acceptanceTests.length; i++) {
                let newTestSuiteLineItem = {};
                newTestSuiteLineItem.attributes = {"type" : "Test_Suite_Line_Item__c", "referenceId" : `ref${i+1}`},
                newTestSuiteLineItem.Test__c = testIds[i];
                newTestSuiteLineItem.Test_Suite__c = testSuite.id;
                newTestSuiteLineItem.Order__c = i + 1;
                testSuiteLineItems.metaData.push(newTestSuiteLineItem);
            }

            const result = await restController.insertMultipleRecords(accessKeyPair,  testSuiteLineItems.objectName, testSuiteLineItems.metaData);
            console.log(result);

        } else {
            let query = `SELECT id,Name FROM Test_Suite__c Where Id='${suiteId}'`;
            let queryResult = await restController.query(accessKeyPair, query);
            if (queryResult.length > 0) {
                testSuite = queryResult[0];
            } else {
                throw new Error(`Error: No Test Siute Found for Given Id ${suiteId}.`);
            }

        }

        //Step - 4: Create TestRun Record with Test Suite
        testRundata.recordData.Name = `${testSuite.Name}`;
        testRundata.recordData.Test_Suite__c = testSuite.Id;
        testRundata.recordData.Environment__c = process.env.ENVIRONMENT;
        testRundata.recordData.Browser__c = process.env.BROWSER;
        const responseData = await restController.createRecord(accessKeyPair, testRundata.recordData, testRundata.objectName);
        recordId = responseData.id;

        //Step - 5 :Generate email subject
        let email_subject = testSuite.Name + 'Execution Triggered';

        //generate email body
        let email_body = email_subject + '\n';
        email_body =
            email_body +
            '\nYou can find your test execution run at the following location:';
        email_body =
            email_body +
            '\n' +
            'https://csg-automation-offering.lightning.force.com/lightning/r/Test_Run__c/' +
            recordId +
            '/view';
        email_body =
            email_body + '\nBROWSER: ' + testRundata.recordData.Browser__c;
        email_body =
            email_body + '\nSandbox: ' + testRundata.recordData.Environment__c;
        email_body =
            email_body + '\nTest Suite: ' + testRundata.recordData.Name;
        email_body = email_body + '\n\n\nThank You!';
        //attempt to send email if email feature is enabled on salesforce
        await restController.email(accessKeyPair, process.env.EMAIL_LIST, email_subject, email_body);
    } catch (e) {
        console.log('error ' + e.stack);
    }
    return recordId;
};

exports.sta_v2_executeTest();