# ----- Lambda functions -----

resource "aws_lambda_function" "ingest" {
  function_name = "${var.project}-ingest"
  role          = aws_iam_role.ingest_lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  filename      = "${path.module}/{zips}/ingest.zip"
  source_code_hash = filebase64sha256("${path.module}/{zips}/ingest.zip")
  environment {
    variables = {
      EVENT_BUS_NAME = aws_cloudwatch_event_bus.bus.name
    }
  }
}

resource "aws_lambda_function" "persist" {
  function_name = "${var.project}-persist"
  role          = aws_iam_role.persist_lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  filename      = "${path.module}/{zips}/persist.zip"
  source_code_hash = filebase64sha256("${path.module}/{zips}/persist.zip")

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.flights.name
    }
  }
}

resource "aws_lambda_function" "worker" {
  function_name = "${var.project}-worker"
  role          = aws_iam_role.worker_lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  filename      = "${path.module}/{zips}/worker.zip"
  source_code_hash = filebase64sha256("${path.module}/{zips}/worker.zip")
}

resource "aws_lambda_function" "get_flight" {
  function_name = "${var.project}-get-flight"
  role          = aws_iam_role.get_flight_lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  filename      = "${path.module}/{zips}/get-flight.zip"
  source_code_hash = filebase64sha256("${path.module}/{zips}/get-flight.zip")

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.flights.name
    }
  }
}

# ----- Lambda permissions (unchanged, but shown for completeness) -----

resource "aws_lambda_permission" "api_invoke_ingest" {
  statement_id  = "AllowAPIGatewayInvokeIngest"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ingest.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*/events"
}

resource "aws_lambda_permission" "api_invoke_get_flight" {
  statement_id  = "AllowAPIGatewayInvokeGetFlight"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_flight.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*/flights*"
}

resource "aws_lambda_permission" "allow_eb_to_invoke_persist" {
  statement_id  = "AllowEventBridgeInvokePersist"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.persist.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.persist_rule.arn
}

resource "aws_lambda_event_source_mapping" "sqs_to_worker" {
  event_source_arn = aws_sqs_queue.downstream.arn
  function_name    = aws_lambda_function.worker.arn
  batch_size       = 5
  enabled          = true
}
