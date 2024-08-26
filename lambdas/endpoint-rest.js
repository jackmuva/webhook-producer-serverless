import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, GetUserCommand } from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});
const dynamo = DynamoDBDocument.from(new DynamoDB());

export const handler = async (event) => {

    let body;
    let statusCode = '200';
    const headers = {
        'Content-Type': 'application/json',
    };

    let dbParam= {
        TableName: process.env.db_name,
        Item:event.item
    }

    const user = await getUser(event.headers.accessToken);

    try {
        switch (event.httpMethod) {
            case 'GET':
                body = await getAllUserEndpoints(user.Username);
                break;
            case 'POST':
                body = await dynamo.put({
                    TableName: process.env.db_name,
                    Item:{...event.item, user_id: user.Username}
                });
                break;
            case 'DELETE':
                body = await dynamo.delete({
                    TableName: process.env.db_name,
                    Key: {
                        'endpoint_id': event.item.endpoint_id,
                        'user_id': user.Username
                    }
                });
                break;
            case 'PUT':
                body = await dynamo.update({
                    TableName: process.env.db_name,
                    Key: {
                        'endpoint_id': event.item.endpoint_id,
                        'user_id': user.Username
                    },
                    UpdateExpression: 'SET #endpoint :newURL',
                    ExpressionAttributeNames: {
                        '#endpoint': 'endpoint',
                    },
                    ExpressionAttributeValues: {
                        ':newURL': event.item.endpoint,
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
        headers,
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
}

async function getUser(accessToken) {
    const input = {
        AccessToken: accessToken,
    };
    const command = new GetUserCommand(input);
    const response = await client.send(command);

    return response;
};