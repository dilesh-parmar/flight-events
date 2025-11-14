# ----- API Gateway HTTP API -----
resource "aws_apigatewayv2_api" "http" {
  name          = "${var.project}-api"
  protocol_type = "HTTP"
}

# POST /events → ingest Lambda
resource "aws_apigatewayv2_integration" "ingest_lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.ingest.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "post_events" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /events"
  target    = "integrations/${aws_apigatewayv2_integration.ingest_lambda.id}"
}

# GET /flights/{id} → get_flight Lambda
resource "aws_apigatewayv2_integration" "get_flight_lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_flight.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_flight" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /flights/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.get_flight_lambda.id}"
}

# Default stage
resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}
