# ----- IAM base (trust policy reused by all Lambda roles) -----
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# ----- Lambda roles -----

resource "aws_iam_role" "ingest_lambda_role" {
  name               = "${var.project}-ingest-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role" "persist_lambda_role" {
  name               = "${var.project}-persist-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role" "worker_lambda_role" {
  name               = "${var.project}-worker-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role" "get_flight_lambda_role" {
  name               = "${var.project}-get-flight-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# ----- Basic Lambda logging for all roles -----

resource "aws_iam_role_policy_attachment" "ingest_logs" {
  role       = aws_iam_role.ingest_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "persist_logs" {
  role       = aws_iam_role.persist_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "worker_logs" {
  role       = aws_iam_role.worker_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "get_flight_logs" {
  role       = aws_iam_role.get_flight_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ----- Least-privilege inline policies -----

# Ingest Lambda: can only put events to this EventBridge bus
resource "aws_iam_role_policy" "ingest_events" {
  name = "${var.project}-ingest-events"
  role = aws_iam_role.ingest_lambda_role.name

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = aws_cloudwatch_event_bus.bus.arn
      }
    ]
  })
}

# Persist Lambda: can only put items into the flights table
resource "aws_iam_role_policy" "persist_ddb" {
  name = "${var.project}-persist-ddb"
  role = aws_iam_role.persist_lambda_role.name

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem"]
        Resource = aws_dynamodb_table.flights.arn
      }
    ]
  })
}

# Get-flight Lambda: can only get items from the flights table
resource "aws_iam_role_policy" "get_flight_ddb" {
  name = "${var.project}-get-flight-ddb"
  role = aws_iam_role.get_flight_lambda_role.name

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:Scan"]
        Resource = aws_dynamodb_table.flights.arn
      }
    ]
  })
}

# Worker Lambda: only allowed to poll the downstream SQS queue
resource "aws_iam_role_policy" "worker_sqs" {
  name = "${var.project}-worker-sqs"
  role = aws_iam_role.worker_lambda_role.name

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.downstream.arn
      }
    ]
  })
}
