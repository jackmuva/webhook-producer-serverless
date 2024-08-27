import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, GetUserCommand } from "@aws-sdk/client-cognito-identity-provider";

const cognito = new CognitoIdentityProviderClient({});
const dynamo = DynamoDBDocument.from(new DynamoDB());

const sqs = new SQSClient({ region: process.env.region });

export const handler = async (event) => {
    let token;

    if (event.headers && event.headers.accesstoken && event.headers.accesstoken != "") {
        token = event.headers.accesstoken;
    }else if (event.multiValueHeaders && event.multiValueHeaders.accesstoken && event.multiValueHeaders.accesstoken != "") {
        token = event.multiValueHeaders.accesstoken;
    }
    const user = await getUser(token);
    const endpointObjects = await getAllUserEndpoints(user.Username);

    let statusCode = 200;
    let body;
    const messageObj = JSON.parse(event.body);
    const items = [];
    try{
        for (const endpointObject of endpointObjects) {
            const res = await sendMessage(endpointObject.endpoint, endpointObject.user_id,
                endpointObject.key_location, endpointObject.endpoint_id,
                messageObj.message_id, messageObj.message);
            items.push(res);
        }
        body = items;
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
}

async function getUser(accessToken) {
    const input = {
        AccessToken: accessToken,
    };
    const command = new GetUserCommand(input);
    const response = await cognito.send(command);

    return response;
};

async function sendMessage(endpoint, user_id, key_location, endpoint_id, message_id, message){
    const params = {
        MessageAttributes: {
            endpoint: {
                DataType: "String",
                StringValue: endpoint,
            },
            user_id: {
                DataType: "String",
                StringValue: user_id,
            },
            key_location: {
                DataType: "String",
                StringValue: key_location,
            },
        },
        MessageBody: message,
        MessageDeduplicationId:  message_id,  // Required for FIFO queues
        MessageGroupId:  endpoint_id,  // Required for FIFO queues
        QueueUrl: process.env.queueUrl,
    };

    const command = new SendMessageCommand(params);
    const response = await sqs.send(command);

    return response;
};
