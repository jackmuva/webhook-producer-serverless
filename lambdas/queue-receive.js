import axios from 'axios'


export const handler = async (event) => {
    const response = []
    for (const message of event.Records) {
        const res = await processMessageAsync(message);
        response.push(res);
    }
    return response
};

async function processMessageAsync(message) {
    const response = {};
    try {
        const messageData = {
            message: message.body,
        }
        response.message = await doPostRequest(messageData, message.messageAttributes.endpoint.stringValue);
    } catch (err) {
        response.message = err;
    }
    return response;
}

const doPostRequest = async(data, endpoint) => {
    const response = {};
    try {
        const res = await axios.post(endpoint, data, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Node.js'
            }
        });
        response.status = res.status;
    } catch (error) {
        console.log(`Error message: ${error.message}`);
        console.log(`Error code: ${error.code}`);

        response.status = error.code;
        response.message = error.message;
    }
    return response;
};