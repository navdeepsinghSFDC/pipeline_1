const axios = require('axios');
const fs = require('fs');
const SALESFORCE_RECORD_URL_SEGMENT = "sobjects";
const SALESFORCE_APEX_URL_SEGMENT = "services/apexrest";
const SALESFORCE_ATTACHMENT_URL_SEGMENT = "Attachment";
const SALESFORCE_QUERY_URL_SEGMENT = "query?q=";
const SALESFORCE_TREE_URL_SEGMENT = "composite/tree";
const SALESFORCE_GRAPH_URL_SEGMENT = "composite/graph";

if(typeof process.env.REST_ENDPOINT === "undefined" || process.env.REST_ENDPOINT.length === 0 ||
    typeof process.env.API_VERSION === "undefined" || process.env.API_VERSION.length === 0 ||
    typeof process.env.GRANT_SERVICE === "undefined" || process.env.GRANT_SERVICE.length === 0 ){
    throw new Error(`Error: SalesforceRestController critical environment settings required.`);
}

/**
 * Get an OAuth token from a connected app / oauth provider within SFDC.
 * @returns {String} OAuth token for querying SFDC REST-based services.
 */
const getAuthenticationToken = async (credential) => {

    //Note: the login url has to match what is in the domain settings
    const OAUTH_GRANT_URL = `${credential.login_url}${process.env.GRANT_SERVICE}&client_id=${credential.client_id}&client_secret=${credential.client_secret}&username=${credential.username}&password=${credential.password}`;
    const response = await axios.post(OAUTH_GRANT_URL);
    let oauthToken = null;

    if (response.status === 200) {
        oauthToken = response.data;
    }

    return oauthToken;
};

/**
 * Get a prepared authentication header necessary to query the SFDC REST API.
 * @param {*} credential optional param
 * @returns {String} Prepared authentication header.
 */
exports.getAccessKeyPair = async (credential) => {
    let accessKeyPair = {};
    let response = null;
    try {
        response = await getAuthenticationToken(credential);
        accessKeyPair.instanceURL = response.instance_url;
        accessKeyPair.baseURL = `${response.instance_url}${process.env.REST_ENDPOINT}/v${process.env.API_VERSION}`;
        accessKeyPair.accessToken = response.access_token;
        accessKeyPair.authenticationHeader = getAuthHeader(response.token_type, response.access_token);
    }
    catch (e) {
        throw new Error(`Error: Failed to obtain an access key pair from SFDC REST API. ${e.stack}`);
    }

    return accessKeyPair;
};

/**
 * Build a basic authentication header for SFDC REST API.
 * @param {String} tokenType The type of token to use within the header.
 * @param {String} accessToken The token to use within the header.
 * @returns
 */
const getAuthHeader = (tokenType, accessToken) => {
    const config = {
        headers: {
            'Authorization': `${tokenType} ${accessToken}`,
            "Content-Type": "application/json"
        }
    }

    return config;
};

/**
 * Get a records detail by record ID using the SFDC REST API.
 * @param {String} objectName Object to request data from.
 * @param {String} recordID Record ID to request.
 * @returns {JSON} Details of the requested record.
 */
exports.getRecordById = async (accessKeyPair, objectName, recordID) => {
    const uri = `${accessKeyPair.baseURL}/${SALESFORCE_RECORD_URL_SEGMENT}/${objectName}/${recordID}`;
    let recordData = null;
    let status;

    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
        recordData = response.data;
    } catch (e) {
        status = e.response.status;

        if (status === 400) {
            throw new Error(`Error: Failed to get record with ID: "${recordID}" from Object: ${objectName}. ${e}`);
        }

        throw new Error(`Error: An error was encountered - SFDC REST API (GET). ${e.stack}`);
    }

    return recordData;
};

/**
 * Get all record IDs for records with given key and associated value
 * @param {String} objectName Object to request data from.
 * @param {String} recordKey record key to search by
 * @param {String} keyValue particular value of above key to look for
 * @returns {JSON} Details of the requested record.
 */
exports.getRecordIdsByKeyValue = async (accessKeyPair, objectName, recordKey, keyValue) => {
    const uri = `${accessKeyPair.baseURL}/query?q=Select+Id+From+${objectName}+Where+${recordKey}+=+'${keyValue}'`;
    let recordData = null;
    let status;

    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
        recordData = response.data;
    } catch (e) {
        status = e.response.status;

        if (status === 400) {
            throw new Error(`Error: Failed to get records with key/value: "${recordKey}/${keyValue}" from Object: ${objectName}. ${e}`);
        }

        throw new Error(`Error: An error was encountered - SFDC REST API (GET). ${e.stack}`);
    }

    return recordData;
};

/**
 * Get all record IDs for records with given json dict of key value pair associations
 * @param {*} accessKeyPair
 * @param {*} objectName
 * @param {*} keyValuePairs
 * @returns
 */
exports.getRecordIdsByMultipleKeyValues = async (accessKeyPair, objectName, keyValuePairs) => {
    let keys = Object.keys(keyValuePairs);
    const uri = `${accessKeyPair.baseURL}/query?q=Select+Id+From+${objectName}`;
    keys.forEach((key,index) => {
        uri += `+Where+${key}+=+'${keyValuePairs[key]}'`;
        if (index < keys.length-1) {
            uri += `+and`;
        }
    });

    let recordData = null;
    let status;

    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
        recordData = response.data;
    } catch (e) {
        status = e.response.status;

        if (status === 400) {
            throw new Error(`Error: Failed to get record IDs: from Object: ${objectName} with given key/value pairs: ${JSON.stringify(keyValuePairs)} ${e}`);
        }

        throw new Error(`Error: An error was encountered - SFDC REST API (GET). ${e.stack}`);
    }

    return recordData;
};

/**
 * Get first record ID by specified record key using the SFDC REST API.
 * @param {String} objectName Object to request data from.
 * @param {String} recordKey record key to search by
 * @param {String} keyValue particular value of above key to look for
 * @returns {JSON} the id of the record
 */
exports.getRecordIdByKeyValue = async (accessKeyPair, objectName, recordKey, keyValue) => {
    const uri = `${accessKeyPair.baseURL}/query?q=Select+Id+From+${objectName}+Where+${recordKey}+=+'${keyValue}'`;

    let recordIDData = null;
    let recordId = null;
    let status;

    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
        recordIDData = response.data;
        recordId = recordIDData.records[0].Id;
    } catch (e) {
        status = e.response.status;

        if (status === 400) {
            throw new Error(`Error: Failed to get record ID with key/value: "${recordKey}/${keyValue}" from Object: ${objectName}. ${e}`);
        }

        throw new Error(`Error: An error was encountered - SFDC REST API (GET). ${e.stack}`);
    }

    return recordId;
};

/**
 * Get FIRST record id in results for specified object with specified key value pair associations
 * @param {*} accessKeyPair
 * @param {*} objectName
 * @param {*} keyValuePairs
 * @returns
 */
exports.getRecordIdByMultipleKeyValues = async (accessKeyPair, objectName, keyValuePairs) => {
    let keys = Object.keys(keyValuePairs);
    const uri = `${accessKeyPair.baseURL}/query?q=Select+Id+From+${objectName}`;
    keys.forEach((key,index) => {
        uri += `+Where+${key}+=+'${keyValuePairs[key]}'`;
        if (index < keys.length-1) {
            uri += `+and`;
        }
    });

    let recordIDData = null;
    let recordId = null;
    let status;

    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
        recordIDData = response.data;
        recordId = recordIDData.records[0].Id;
    } catch (e) {
        status = e.response.status;

        if (status === 400) {
            throw new Error(`Error: Failed to get record ID with key/value: "${recordKey}/${keyValue}" from Object: ${objectName}. ${e}`);
        }

        throw new Error(`Error: An error was encountered - SFDC REST API (GET). ${e.stack}`);
    }

    return recordId;
};

/**
 *
 * @param {*} accessKeyPair
 * @param {*} field
 */
exports.getFieldIdByFieldName = async (accessKeyPair, field) => {
    const uri = `${accessKeyPair.baseURL}/query?q=Select+DurableId+From+FieldDefinition+Where+EntityDefinitionId='Case'+And+QualifiedApiName='${field}'`;

    let recordIDData = null;
    let recordId = null;
    let status;

    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
        recordIDData = response.data;
        recordId = recordIDData.records[0].Id;
    } catch (e) {
        status = e.response.status;

        if (status === 400) {
            throw new Error(`Error: Failed to get field ID with field name: "${field}" -> ${e}`);
        }

        throw new Error(`Error: An error was encountered - SFDC REST API (GET). ${e.stack}`);
    }

    return recordId;
};

/**
 * Get key value for record in specified object and with specified id
 * @param {*} accessKeyPair
 * @param {*} objectName
 * @param {*} keyToReturn
 * @param {*} recordId
 */
exports.getKeyValueByRecordId = async (accessKeyPair, objectName, keyToReturn, recordId) => {
    const uri = `${accessKeyPair.baseURL}/query?q=Select+${keyToReturn}+from+${objectName}+where+Id='${recordId}'`;

    let recordIDData = null;
    let toReturn = null;
    let status;

    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
        recordIDData = response.data;
        toReturn = recordIDData.records[0].keyToReturn;
    } catch (e) {
        status = e.response.status;

        if (status === 400) {
            throw new Error(`Error: Failed to get key value for '${keyToReturn}' for object: ${objectName} with id '${recordId}'. ${e}`);
        }

        throw new Error(`Error: An error was encountered - SFDC REST API (GET). ${e.stack}`);
    }

    return toReturn;
}

/**
 *
 * @param {*} accessKeyPair
 * @param {*} objectName
 * @param {*} field
 * @param {*} key
 * @param {*} value
 */
exports.getSelectedFieldArrayByKey = async (accessKeyPair, objectName, field, key, value) => {
    const uri = `${accessKeyPair.baseURL}/query?q=Select+${field}+From+${objectName}+Where+${key}+=+'${value}'`;

    let recordIDData = null;
    let recordIds = null;
    let status;

    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
        recordIDData = response.data;
        recordIds = recordIDData.records;
    } catch (e) {
        status = e.response.status;

        if (status === 400) {
            throw new Error(`Error: Failed to get ${field} field for ${objectName} records with key/value pair: ${key}/${value}`);
        }

        throw new Error(`Error: An error was encountered - SFDC REST API (GET). ${e.stack}`);
    }

    return recordIds;
}

/**
 * Function to retrieve all values of the specified array of fields of an object based on provided key/value condition for that same object
 * @param {*} accessKeyPair
 * @param {*} objectName
 * @param {*} field
 */
 exports.getRecordsWithFieldsByWhereClause = async (accessKeyPair, objectName, fields, whereClause) => {
    let fieldUriSectionString = '';
    fields.forEach((field,index,array) => {
        if (index < array.length-1) {
            fieldUriSectionString += `${field},`;
        } else {
            fieldUriSectionString += `${field}`;
        }
    });

    const uri = `${accessKeyPair.baseURL}/query?q=Select+${fieldUriSectionString}+From+${objectName}+Where+${whereClause}`;

    let recordIDData = null;
    let recordIds = null;
    let status;

    try {
        const response = await axios.get(uri,accessKeyPair.authenticationHeader);
        recordIDData = response.data;
        recordIds = recordIDData.records;
    } catch (e) {
        status = e.response.status;

        if (status === 400) {
            throw new Error(`Error: Failed to get ${field} field for ${objectName} records with key/value pair: ${key}/${value}`);
        }

        throw new Error(`Error: An error was encountered - SFDC REST API (GET). ${e.stack}`);
    }

    return recordIds;
}


/**
 * Get first record ID by specified Where clause using the SFDC REST API.
 * @param {String} objectName Object to request data from.
 * @param {String} whereClause Where clause for search without the word Where in it.
 * @returns {JSON} the id of the record
 */
 exports.getRecordIdByWhereClause = async (accessKeyPair, objectName, whereClause) => {
    const uri = `${accessKeyPair.baseURL}/query?q=Select+Id+From+${objectName}+Where+${whereClause}`;

    let recordIDData = null;
    let recordId = null;
    let status;

    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
        recordIDData = response.data;
        recordId = recordIDData.records[0].Id;
    } catch (e) {
        throw new Error(`Error: Failed to get record ID with Where Clause: ` + whereClause + ` from Object: ` + objectName);
    }
    return recordId;
};

/**
 * Get first record ID by specified Where clause using the SFDC REST API.  If not found, don't error, just return Null
 * @param {String} objectName Object to request data from.
 * @param {String} whereClause Where clause for search without the work Where in it.
 * @returns {JSON} the id of the record or Null if not found
 */
 exports.getRecordIdByWhereClauseIgnoreError = async (accessKeyPair, objectName, whereClause) => {
    const uri = `${accessKeyPair.baseURL}/query?q=Select+Id+From+${objectName}+Where+${whereClause}`;

    let recordIDData = null;
    let recordId = null;
    let status;

    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
        recordIDData = response.data;
        recordId = recordIDData.records[0].Id;
    } catch (e) {
        console.log(`Failed to find record:  ${objectName}. returning null`);
    }
    return recordId;
};

/**
 * Get first record ID by record ID using the SFDC REST API.
 * @param {String} objectName Object to request data from.
 * @param {String} recordKey key name from desired record to be returned
 * @param {String} recordID Record ID to request
 * @returns {JSON} Details of the requested record.
 */
 exports.getRecordValueById = async (accessKeyPair, objectName, recordKey, recordID) => {
    const uri = `${accessKeyPair.baseURL}/query?q=Select+${recordKey}+From+${objectName}+Where+Id+=+'${recordID}'`;

    let recordIDData = null;
    let status;

    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
        recordIDData = response.data;
    } catch (e) {
        status = e.response.status;

        if (status === 400) {
            throw new Error(`Error: Failed to get record with ID: "${recordKey}" from Object: ${objectName}. ${e}`);
        }

        throw new Error(`Error: An error was encountered - SFDC REST API (GET). ${e.stack}`);
    }

    return recordIDData;
};

/**
 * Get all ID's from passed object
 * @param {*} accessKeyPair
 * @param {*} objectName
 */
exports.getAllRecordsFromObject = async (accessKeyPair, objectName) => {
    const uri = `${accessKeyPair.baseURL}/query?q=Select+Id+From+${objectName}`;

    let recordIDData = null;
    let status;

    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
        recordIDData = response.data;
    } catch (e) {
        status = e.response.status;

        if (status === 400) {
            throw new Error(`Error: Failed to get record ID's from Object: ${objectName}. ${e}`);
        }

        throw new Error(`Error: An error was encountered - SFDC REST API (GET). ${e.stack}`);
    }

    return recordIDData;
};

exports.getGroupIdByName = async (accessKeyPair, groupName) => {
    const uri = `${accessKeyPair.baseURL}/query?q=Select+GroupId+From+GroupMember+Where+Id+=+'${recordID}'`;

    let recordIDData = null;
    let status;
};

/**
 * Get a records detail by record ID using the SFDC REST API using SOQL.
 * @param {String} query SQL query to pass to the SFDC REST API in order to (GET) a record.
 * @returns {JSON} Result set of the provided query.
 */
exports.query = async (accessKeyPair, query) => {
    const uri = `${accessKeyPair.baseURL}/${SALESFORCE_QUERY_URL_SEGMENT}${query}`;
    let data = [];
    try {
        let response = await axios.get(uri, accessKeyPair.authenticationHeader);
        data = data.concat(response.data.records);
        while (!response.data.done) {
            response = await axios.get(`${accessKeyPair.instanceURL}${response.data.nextRecordsUrl}`, accessKeyPair.authenticationHeader);
            data = data.concat(response.data.records);
        }
    } catch (e) {
        let errorMessage = `Error: An error was encountered executing - ${uri} - ${e.message} - ${e.response} - ${e.stack}`;
        console.log(errorMessage);
        throw new Error(errorMessage);
    }

    return data;
};

exports.queryByBatch = async (accessKeyPair, query, testsIdList) => {

    let data = [];

    let queryWhereClause = "";
    if(typeof testsIdList !== "undefined" && testsIdList.length > 0){

        const chunkSize = 100;
        for (let i = 0; i < testsIdList.length; i += chunkSize) {
            const chunk = testsIdList.slice(i, i + chunkSize);

            const testList = "'" + chunk.join("', '") + "'";
            queryWhereClause = `Where Id in (${testList})`;
            data = [...data, ...await exports.query(accessKeyPair, query + ' ' + queryWhereClause)];
        }
    }
    else{
        data = await exports.query(accessKeyPair, query);
    }

    return data;
};

/**
 * Create a new record using the SFDC REST API.
 * @param {String} objectName Object to post data to.
 * @param {JSON} data Data to insert.
 * @returns {JSON} Query result.
 */
exports.createRecord = async (accessKeyPair, data, objectName) => {
    const uri = `${accessKeyPair.baseURL}/${SALESFORCE_RECORD_URL_SEGMENT}/${objectName}/`;
    let result = null;
    let response;
    try {
        response = await axios.post(uri, data, accessKeyPair.authenticationHeader);
        result = response.data;
    } catch (e) {
        console.log(`Failed to create a new ${objectName} record.`);
        console.log('uri: ' + uri);
        console.log('response: '+ JSON.stringify(response));
        let responseBody =  'response' in e ? JSON.stringify(e.response.data) : 'No response body';
        console.log(`Error response: ${e.response.data[0].message}`);
        throw new Error(`Failed to create a new ${objectName} record: ${responseBody} stack trace: ${e.stack}`);
    }

    return result;
};

/**
 * Edit a record using the SFDC REST API.
 * @param {String} objectName Object to post data to.
 * @param {JSON} data Key/values to update.
 * @param {String} recordID ID of the record to update.
 * @returns Query result.
 */
 exports.editRecord = async (accessKeyPair, data, objectName, recordID) => {
    const uri = `${accessKeyPair.baseURL}/${SALESFORCE_RECORD_URL_SEGMENT}/${objectName}/${recordID}`;
    let result = null;
    let response;
    try {
        response = await axios.patch(uri, data, accessKeyPair.authenticationHeader);
        result = response.data;
    } catch (e) {
        console.log(e.stack);
        console.log(`Error response: ${e.response.data[0].message}`);
        throw new Error(`Failed to edit (POST) object: ${objectName} with record ID: ${recordID}. ${e.stack}`);
    }

    return result;
};

/**
 * Update users password using the SFDC REST API.
 * @param {String} objectName Object to post data to.
 * @param {JSON} data Key/values to update.
 * @param {String} recordID ID of the record to update.
 * @returns Query result.
 */
 exports.updateUserPassword = async (accessKeyPair, data, objectName, recordID) => {
    const uri = `${accessKeyPair.baseURL}/${SALESFORCE_RECORD_URL_SEGMENT}/${objectName}/${recordID}/password`;
    let result = null;
    let response;
    try {
        response = await axios.patch(uri, data, accessKeyPair.authenticationHeader);
        result = response.data;
    } catch (e) {
        console.log(e.stack);
        console.log(`Error response: ${e.response.data[0].message}`);
        throw new Error(`Failed to update password (POST) object: ${objectName} with record ID: ${recordID}. ${e.stack}`);
    }

    return result;
};

/**
 * Delete a record using the SFDC REST API.
 * @param {String} objectName Object which owns the record to delete.
 * @param {String} recordID ID of the record to delete.
 * @returns Query result.
 */
exports.deleteRecord = async (accessKeyPair, objectName, recordID) => {
    const uri = `${accessKeyPair.baseURL}/${SALESFORCE_RECORD_URL_SEGMENT}/${objectName}/${recordID}`;
    let result = null;
    let response;

    try {
        response = await axios.delete(uri, accessKeyPair.authenticationHeader);
        result = response.data;
    } catch (e) {
        console.log(`Error response: ${e.response.data[0].message}`);
        throw new Error(`Failed to delete object: ${objectName} with record ID: ${recordID}. ${e.stack}`);
    }

    return result;
};

/**
 * Create a new record using the SFDC APEX REST API.
 * @param {String} objectName Object to post data to.
 * @param {JSON} data Data to insert.
 * @returns {JSON} Query result.
 */
exports.createApexRecord = async (accessKeyPair, data, objectName) => {
    const uri = `${accessKeyPair.instanceURL}/${SALESFORCE_APEX_URL_SEGMENT}/${objectName}/`;
    let result = null;
    let response;
    try {
        response = await axios.post(uri, data, accessKeyPair.authenticationHeader);
        result = response.data;
    } catch (e) {
        let responseBody =  'response' in e ? JSON.stringify(e.response.data[0].message) : 'No response body';
        throw new Error(`Failed to create a new Apex ${objectName} record: ${responseBody}\n stack trace: ${e.stack}`);
    }

    return result;
};

exports.insertMultipleRecords = async (accessKeyPair, objectName, data) => {
    var data_to_insert = { records: data };
    const uri = `${accessKeyPair.baseURL}/${SALESFORCE_TREE_URL_SEGMENT}/${objectName}/`;
    let result = null;
    let response;
    try {
        response = await axios.post(uri, JSON.stringify(data_to_insert), accessKeyPair.authenticationHeader);
        result = response.data;
    } catch (e) {
        console.log(JSON.stringify(response));
        console.log(`Failed to create a new ${objectName} record. stack trace: ${e.stack}`);
        throw new Error(`Failed to create a new ${objectName} record. stack trace: ${e.stack}`);
    }

    return result;
}

exports.insertViaDataGraph = async (accessKeyPair, graph) => {
    const uri = `${accessKeyPair.baseURL}/${SALESFORCE_GRAPH_URL_SEGMENT}`;
    let result = null;
    let response;
    try {
        response = await axios.post(uri, JSON.stringify(graph), accessKeyPair.authenticationHeader);
        result = response.data;
    } catch (e) {
        console.log(JSON.stringify(response));
        console.log(`Failed to insert data via using ${graph}. stack trace: ${e.stack}`);
        throw new Error(`Failed to insert data via using ${graph}. stack trace: ${e.stack}`);
    }

    return result;
}

exports.updateMultipleRecords = async (accessKeyPair, data) => {
	var data_to_update = {allOrNone : false, records : data};
	const uri = `${accessKeyPair.baseURL}/composite/sobjects`;
    let result = null;
    let response;
	try{
        response = await axios.patch(uri, JSON.stringify(data_to_update), accessKeyPair.authenticationHeader);
        result = response.data;
    } catch (e) {
        console.log(JSON.stringify(response));
        console.log(`Failed to update ${objectName} record. stack trace: ${e.stack}`);
        throw new Error(`Failed to update ${objectName} record. stack trace: ${e.stack}`);
    }

    return result;
}

exports.addAttachmentToRecord = async (accessKeyPair, recordId, attachmentName, attachmentPath) => {
    const uri = `${accessKeyPair.baseURL}/${SALESFORCE_RECORD_URL_SEGMENT}/${SALESFORCE_ATTACHMENT_URL_SEGMENT}`;
    const body = await fs.readFileSync(attachmentPath, { encoding: 'base64' });
    var data = {
        "Name": attachmentName,
        "Body": body,
        "parentId": recordId
    }

    let result = null;
    let response;

    try {
        response = await axios.post(uri, data, accessKeyPair.authenticationHeader);
        result = response.data;
    } catch (e) {
        console.log(e);
    }

    return result;
};

const removeAttributeFromJsonArray = (json) => {
    json.filter(record => delete record.attributes);
}

const writeJsonToFile = async (path, json) => {
    let data = JSON.stringify(json, null, 4);
    fs.writeFileSync(path, data);
    console.log(`Import local ${path} succceed`);
}

exports.getAllCredentials = async (accessKeyPair) => {
    const credentials = await exports.query(accessKeyPair, "Select Id, Name, Secret__c From Credential__c");
    console.log(credentials);
    return credentials;
}

exports.getAllUsers = async (accessKeyPair) => {
    const users = await exports.query(accessKeyPair, "Select Id, Name, Status__c, User__r.Name From Service_User__c");
    console.log(users);
    return users;
}

exports.getUserById = async (accessKeyPair, recordId) => {
    const user = await exports.getRecordById(accessKeyPair, "Service_User__c", recordId);
    return user;
}

exports.updateUserById = async (accessKeyPair, data, recordID) => {
    const user = await exports.editRecord(accessKeyPair, data, "Service_User__c", recordID);
    return user;
}

/**
 * Get picklist values for provided object and associate picklist using the SFDC REST API.
 * @param {String} objectName Object to request data from.
 * @param {String} pickListName picklist associate to object
 * @returns {JSON} Details of the requested record.
 */
 exports.getPicklistValues = async (accessKeyPair, objectName, pickListName) => {
    const uri = `${accessKeyPair.baseURL}/ui-api/object-info/${objectName}/picklist-values/012000000000000AAA/${pickListName}`;

    let pickListValues = [];
    let status;

    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
        response.data.values.forEach( (element) => {
            pickListValues.push(element.value);
        })
        console.log(`Picklist values for ${pickListName} picklist under ${objectName} object:\n${pickListValues}`);
    } catch (e) {
        status = e.response.status;

        if (status === 400) {
            throw new Error(`Error: Failed to get picklist: "${pickListName}" from Object: ${objectName}. ${e}`);
        }

        throw new Error(`Error: An error was encountered - SFDC REST API (GET). ${e.stack}`);
    }

    return pickListValues;
};

exports.loadAllData = async (accessKeyPair, dataLocatorIdSet) => {
    let queryDataSetWhereClause = "";
    let queryDataValueWhereClause = "";
    let queryLocatorWhereClause = "";

    //if dataLocatorIdSet is not defined then will pull all data
    if(typeof dataLocatorIdSet !== "undefined"){
        if(typeof dataLocatorIdSet.dataIdSet !== "undefined" && dataLocatorIdSet.dataIdSet.length > 0){
            const dataList = "'" + dataLocatorIdSet.dataIdSet.join("', '") + "'";

            queryDataSetWhereClause = `Where Id in (${dataList})`;
            queryDataValueWhereClause = `Where DataSet__c in (${dataList})`;
        }
        if(typeof dataLocatorIdSet.locatorIdSet !== "undefined" && dataLocatorIdSet.locatorIdSet.length > 0){
            const locatorList = "'" + dataLocatorIdSet.locatorIdSet.join("', '") + "'";
            queryLocatorWhereClause = `Where Id in (${locatorList})`;
        }
    }
    const dataSets = await exports.query(accessKeyPair, `Select Id, Name, Master_Value__c,DateModifier__c, RandomType__c, Type__c from DataSet__c ${queryDataSetWhereClause} ORDER By DataSet__c.Name`);
    const dataValues = await exports.query(accessKeyPair, `Select DataSet__r.Id,DataSet__r.DateModifier__c, DataSet__r.Name, DataSet__r.Type__c, DataSet__r.RandomType__c, Environment__c, Value__c from Data_Value__c ${queryDataValueWhereClause} ORDER By DataSet__r.Name ASC`);
    const locators = await exports.query(accessKeyPair, `Select Id, Name, Locator__c, Page__r.Id, Page__r.Name From Element__c ${queryLocatorWhereClause} ORDER By Page__r.Name ASC`);

    removeAttributeFromJsonArray(dataValues);
    removeAttributeFromJsonArray(locators);
    removeAttributeFromJsonArray(dataSets);

    if (!fs.existsSync('./data')) {
        fs.mkdirSync('./data');
    }

    //for local
    await writeJsonToFile(`./data/locators.json`, locators);
    await writeJsonToFile(`./data/dataValues.json`, dataValues);
    await writeJsonToFile(`./data/dataSets.json`, dataSets);
}

exports.email = async (accessKeyPair, emailAddresses, emailSubject, emailBody) => {

    //let accessKeyPair = await exports.getAccessKeyPair(credential);
    const uri = `${accessKeyPair.baseURL}/actions/standard/emailSimple`;
    console.log("uri: " + uri);

    let result = null;
    let response;

    let data = {
        "inputs": [
            {
                "emailBody": emailBody,
                "emailAddresses": emailAddresses,
                "emailSubject": emailSubject
            }
        ]
    };

    console.log("accessKeyPair: " + JSON.stringify(accessKeyPair));

    try {
        response = await axios.post(uri, data, accessKeyPair.authenticationHeader);
        result = response.data;
        console.log( "SalesforceRestController email - response.data: " + JSON.stringify(response.data));
    } catch (e) {
        console.log("Failed to send email!");

        console.log(response);
        console.log(e);
    }

    return result;
}

exports.updateUserPassword = async (accessKeyPair, jsonData, objectName, recordId) => {
    const uri = `${accessKeyPair.baseURL}/${SALESFORCE_RECORD_URL_SEGMENT}/${objectName}/${recordId}/password/`;
    let result = null;
    let response;
    try {
        response = await axios.post(uri, jsonData, accessKeyPair.authenticationHeader);
        result = response.data;
    } catch (e) {
        console.log(`Failed to update user password for User record.`);
        console.log('uri: ' + uri);
        console.log('response: '+ JSON.stringify(response));
        let responseBody =  'response' in e ? JSON.stringify(e.response.data) : 'No response body';
        console.log(`Error response: ${e.response.data[0].message}`);
        throw new Error(`Failed to create a new ${objectName} record: ${responseBody} stack trace: ${e.stack}`);
    }

    return result;
}

/**
 * Execute a Batch job in salesforce using the rest api.
 *
 * @param jobName   - The name of the batch job being executed.
 * @return {boolean}  - Returns the status of the batch request
*/
exports.submitBatchJob = async (accessKeyPair, jobName) => {
    console.log("Executing submitBatchJob: " + jobName);

    const uri = `${accessKeyPair.baseURL}/tooling/executeAnonymous/?anonymousBody=Database.executeBatch(new%20${jobName}())%3B`;
    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
    } catch (e) {
        throw new Error(`Error: Failed to execute batch job: "${jobName}".\n ${e}`);
    }

    const apexClassId = await this.getRecordIdByKeyValue(accessKeyPair, "ApexClass", "Name", jobName);
    const statusRequest = `SELECT Status FROM AsyncApexJob WHERE ApexClassId = '${apexClassId}' ORDER BY CreatedDate DESC Limit 1`
    let waitTime = 0;

    for (let i = 1; i < 30; i++) {
        const logEntries = await exports.query(accessKeyPair, statusRequest);
        if(logEntries[0].Status === 'Completed') {
            return true;
        }   else {
            console.log(`'${jobName}' Status: ${logEntries[0].Status}. Sleeping for ${i} seconds and checking status again.`);
            waitTime = i * 1000
            await sleep(waitTime);
        }
    }
    console.log(`Error: Batch '${jobName}' did not Complete in the alloted time.`);
    return false;
}

/**
 * Execute a Apex Script in salesforce using the rest api.
 *
 * @param anonymousBody  - Formatted Anonymous body
 * @return {boolean}     - Returns the status of the request
*/
exports.executeAnonymous = async (accessKeyPair, anonymousBody) => {
    console.log("Executing Anonymous Job");

    const uri = `${accessKeyPair.baseURL}/tooling/executeAnonymous/?anonymousBody=${anonymousBody}`;
    try {
        const response = await axios.get(uri, accessKeyPair.authenticationHeader);
    } catch (e) {
        throw new Error(`Error: Failed to execute anonymous job.\n ${e}`);
    }

    const statusRequest = `SELECT Status FROM AsyncApexJob WHERE JobType = 'ApexToken' ORDER BY CreatedDate DESC Limit 1`
    let waitTime = 0;

    for (let i = 1; i < 30; i++) {
        const logEntries = await exports.query(accessKeyPair, statusRequest);
        if(logEntries[0].Status === 'Completed') {
            return true;
        }   else {
            console.log(`'Status: ${logEntries[0].Status}. Sleeping for ${i} seconds and checking status again.`);
            waitTime = i * 1000
            await sleep(waitTime);
        }
    }
    console.log(`Error: Anonymous Job did not Complete in the alloted time.`);
    return false;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}