import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, GetUserCommand } from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});
const dynamo = DynamoDBDocument.from(new DynamoDB());

export const handler = async (event) => {

    let body;
    let statusCode = '200';
    const endpointObj = JSON.parse(event.body);

    let token;

    if (event.headers && event.headers.accesstoken && event.headers.accesstoken != "") {
        token = event.headers.accesstoken;
    }else if (event.multiValueHeaders && event.multiValueHeaders.accesstoken && event.multiValueHeaders.accesstoken != "") {
        token = event.multiValueHeaders.accesstoken;
    }

    const user = await getUser(token);

    try {
        switch (event.httpMethod) {
            case 'GET':
                body = await getAllUserEndpoints(user.Username);
                break;
            case 'POST':
                body = await dynamo.put({
                    TableName: process.env.db_name,
                    Item:{...endpointObj, user_id: user.Username}
                });
                break;
            case 'DELETE':
                body = await dynamo.delete({
                    TableName: process.env.db_name,
                    Key: {
                        'endpoint_id': endpointObj.endpoint_id,
                        'user_id': user.Username
                    }
                });
                break;
            case 'PUT':
                body = await dynamo.update({
                    TableName: process.env.db_name,
                    Key: {
                        'endpoint_id': endpointObj.endpoint_id,
                        'user_id': user.Username
                    },
                    UpdateExpression: 'SET #endpoint :newURL',
                    ExpressionAttributeNames: {
                        '#endpoint': 'endpoint',
                    },
                    ExpressionAttributeValues: {
                        ':newURL': endpointObj.endpoint,
                    },
                });
                break;
            default:
                throw new Error(`Unsupported method "${event.httpMethod}"`);
        }
    } catch (err) {
        statusCode = '400';
        body = err.message;
    } finally {
        body = JSON.stringify(body);
    }

    return {
        statusCode,
        body,
        headers: {
            "Access-Control-Allow-Headers" : "Content-Type",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
            "Content-Type": "application/json"
        }
    };
};

async function getAllUserEndpoints(userId){
    let params = {
        FilterExpression : 'user_id = :userId',
        ExpressionAttributeValues : {':userId' : userId},
        TableName: process.env.db_name
    };

    const response = await dynamo.scan(params);

    return response.Items;
};

async function getUser(accessToken) {
    const input = {
        AccessToken: accessToken,
    };
    const command = new GetUserCommand(input);
    const response = await client.send(command);

    return response;
};