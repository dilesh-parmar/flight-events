# ----- SQS -----
resource "aws_sqs_queue" "downstream" {
  name = "${var.project}-downstream-queue"
}

resource "aws_sqs_queue_policy" "downstream_policy" {
  queue_url = aws_sqs_queue.downstream.id
  policy    = jsonencode({
    Version   = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.downstream.arn
      Condition = {
        ArnEquals = {
          "aws:SourceArn" = aws_cloudwatch_event_rule.async_rule.arn
        }
      }
    }]
  })
}
