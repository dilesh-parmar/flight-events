# ----- DynamoDB -----
resource "aws_dynamodb_table" "flights" {
  name         = "${var.project}-flights"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "flightId"

  attribute {
    name = "flightId"
    type = "S"
  }
}
