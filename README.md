# webhook-producer-serverless
## Lessons Learned:
- Enable CORS by having appropriate response headers returned by lambda
- Enable CORS in API Gateway and allow relevant headers
- If using Lambda Proxy, select ANY for API type
  - request and response need to be formatted specifically to documentation