output "api_invoke_url"   { value = aws_apigatewayv2_api.http.api_endpoint }
output "event_bus_name"   { value = aws_cloudwatch_event_bus.bus.name }
output "dynamodb_table"   { value = aws_dynamodb_table.flights.name }
output "sqs_queue_url"    { value = aws_sqs_queue.downstream.id }
