# ----- EventBridge bus -----
resource "aws_cloudwatch_event_bus" "bus" {
  name = "${var.project}-bus"
}

# ----- EventBridge rules -----
# Persist rule → Lambda
resource "aws_cloudwatch_event_rule" "persist_rule" {
  name           = "${var.project}-persist-rule"
  event_bus_name = aws_cloudwatch_event_bus.bus.name
  event_pattern  = jsonencode({ "detail-type" : ["flight.created", "flight.updated"] })
}

resource "aws_cloudwatch_event_target" "persist_target" {
  rule           = aws_cloudwatch_event_rule.persist_rule.name
  event_bus_name = aws_cloudwatch_event_bus.bus.name
  target_id      = "persist"
  arn            = aws_lambda_function.persist.arn
}

# Async rule → SQS
resource "aws_cloudwatch_event_rule" "async_rule" {
  name           = "${var.project}-async-rule"
  event_bus_name = aws_cloudwatch_event_bus.bus.name
  event_pattern  = jsonencode({ "detail-type" : ["flight.updated"] })
}

resource "aws_cloudwatch_event_target" "async_target" {
  rule           = aws_cloudwatch_event_rule.async_rule.name
  event_bus_name = aws_cloudwatch_event_bus.bus.name
  target_id      = "downstream-queue"
  arn            = aws_sqs_queue.downstream.arn
}
