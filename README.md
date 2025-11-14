# Flight Events – Learning Node.js Through an Event‑Driven Flight events 🌍✈️

This repository is the result of a one‑week deep dive into **Node.js** and **serverless/event‑driven architecture on AWS**.

It’s my **first project using Node.js**, and I chose to build something that would force me to touch multiple parts of a real system: APIs, background processing, infrastructure, testing, and deployment. The goal wasn’t just to “get it working”, but to **show that I can pick up a new stack quickly, structure a small system, and ship it end‑to‑end**.

---
## Why this project matters to me

This repo is less about “a production‑ready flight system” and more about **showing how I learn**:

- I took a stack I hadn’t used before (Node.js).
- In about a week, I:
	- Learned the basics.
	- Designed a small event‑driven architecture.
	- Implemented it with tests.
	- Deployed it with infrastructure as code.
- I hit real issues—and fixed them—rather than hiding them.

If you’re reading this as part of reviewing my work: this is how I approach new technology. I like to pick something concrete, break it into pieces, wire them together, and keep iterating until it not only runs, but also makes sense.

If you’d like to know more about any part (design decisions, trade‑offs, or what I’d do next with more time), I’m happy to walk through it.
## Why this project exists

I wanted a project that:

- Was **more than a to‑do app**.
- Demonstrated how I think about **events, data flow, and boundaries**.
- Let me learn **Node.js**, and further development  with **AWS**, and **Terraform**.
- Could be explained as a coherent story, not just a collection of scripts.

So I imagined a simple flight information system:

- Clients **ingest flight events** (e.g. “Flight AB123 is boarding”).
- The system **routes those events** through an event bus.
- Different components **react to those events**:
	- One persists them to DynamoDB.
	- Another does background work via SQS and a worker.
- A separate API lets you **query flight status**.

This gave me a realistic problem to solve, and plenty of opportunities to learn.

---

## The story the system tells

Think of the system as a small airline backend:

1. A flight event comes in:
	 - `POST /events` with details like `flightId`, `status`, `gate`.
	 - This event is validated and published onto an **EventBridge** bus.

2. The event flows through the system:
	 - A **persist Lambda** listens to those events and writes them into **DynamoDB**.
	 - A **worker Lambda** can receive selected events via **SQS** for async/background tasks.

3. A client wants to know what’s happening:
	 - `GET /flights/{id}` returns the latest state of a single flight.
	 - `GET /flights` returns all known flights.

Behind that simple API is an event‑driven pipeline that I had to design, wire up, test, and deploy.

---

## What I focused on learning

During this week, I deliberately pushed myself into areas I hadn’t used before:

- **Node.js on AWS Lambda**
	- Using Node’s built‑in **test runner** (`node:test`) instead of reaching for a big framework.
	- Structuring handlers and shared libraries in a way that works both locally and in Lambda zips.

- **AWS SDK v3 with Node**
	- Talking to **DynamoDB** with `DynamoDBDocumentClient` and commands like `GetCommand`, `PutCommand`, `ScanCommand`.
	- Publishing to **EventBridge** with `PutEventsCommand`.

- **Event‑driven thinking**
	- Designing **event shapes** (what’s in `Detail`, what’s in `detail-type`).
	- Separating **ingestion**, **persistence**, and **background processing** via an event bus.

- **Terraform**
	- Defining **Lambda functions**, **API Gateway HTTP APIs**, **EventBridge rules/targets**, **DynamoDB**, **SQS**, and **IAM** from scratch.
	- Chasing down the inevitable “small but painful” mistakes (like event patterns not matching what the code actually sends).

- **Testing**
	- Using `aws-sdk-client-mock` to simulate AWS services in unit tests.
	- Writing tests not just for “happy paths”, but for validation errors, missing items, and failure cases.

---

## High‑level architecture

At a glance, the system looks like this:

```text
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Ingest    │─────▶│ EventBridge  │─────▶│   Persist    │
│   Lambda    │      │     Bus      │      │   Lambda     │
└─────────────┘      └──────────────┘      └──────────────┘
														 │                      │
														 │                      ▼
														 │              ┌──────────────┐
														 │              │  DynamoDB    │
														 │              │    Table     │
														 │              └──────────────┘
														 │                      │
														 ▼                      │
										 ┌──────────────┐              │
										 │    Worker    │              │
										 │   Lambda     │              │
										 └──────────────┘              │
																									 │
┌─────────────┐                                   │
│ Get Flight  │───────────────────────────────────┘
│   Lambda    │         (Query DynamoDB)
└─────────────┘
```

### Main components

- **Ingest Lambda** (`app/ingest`)
	- HTTP `POST /events`.
	- Validates payloads.
	- Publishes normalized events to an EventBridge bus.

- **Persist Lambda** (`app/persist`)
	- Triggered by EventBridge rules.
	- Writes flight records into a DynamoDB table.

- **Worker Lambda** (`app/worker`)
	- Triggered by SQS.
	- Represents async/background processing (logging, fan‑out, etc).

- **Get Flight Lambda** (`app/get-flight`)
	- HTTP `GET /flights/{id}` to fetch a single flight.
	- HTTP `GET /flights` to list all flights (added after the first version, as an extension).

- **Shared libraries** (`app/lib`)
	- `mini-bus.js`: a tiny event bus abstraction (async `emitAsync` on top of `EventEmitter`).
	- `logger.js`: JSON structured logging.
	- `validation.js`: centralised validation rules for ingestion and queries.

- **Infrastructure** (`terraform/`)
	- `apigw.tf`: HTTP API routes for `/events` and `/flights`.
	- `lambda.tf`: Lambda definitions + permissions.
	- `eventbridge.tf`: custom EventBridge bus and routing rules.
	- `dynamodb.tf`: flights table.
	- `sqs.tf`: downstream queue for worker.
	- `iam.tf`: IAM roles and least‑privilege policies.
	- `outputs.tf`: key outputs like API URL and resource names.

---

## How the code is organised

```text
flight-events/
├── app/
│   ├── get-flight/      # GET /flights, GET /flights/{id}
│   ├── ingest/          # POST /events
│   ├── persist/         # EventBridge consumer -> DynamoDB
│   ├── worker/          # SQS consumer -> background work
│   └── lib/             # Shared logger, mini-bus, validation (+ tests)
├── scripts/
│   └── build_zips.sh    # Build Lambda deployment zips
├── terraform/           # All infra as code
└── package.json         # Root devDependencies (AWS SDK, mocks)
```

I wrote **unit tests for each Lambda and each shared library**, using Node’s built‑in test runner. That was important to me: if I’m claiming I can learn a new stack quickly, I also want to show I can keep it testable and maintainable.

---

## What I learned from the rough edges

A big part of this project was wrestling with the little details that don’t show up in tutorials:

- **Import paths vs. Lambda zip structure**
	- Locally, `lib` lives in `app/lib`.
	- In Lambda zips, I needed `lib/` at the root of each function.
	- I solved this by:
		- Keeping imports as `require('./lib/...')` for Lambda.
		- Creating symlinks in each function folder for local tests.
		- Adjusting the build script to copy the real `lib` folder into each zip.

- **EventBridge event patterns**
	- My first attempt at patterns didn’t match the `detail-type` my code was emitting.
	- I fixed it by matching on the **`source`** (`"app.flights"`) instead, which is more robust as event types evolve.

- **Terraform gotchas**
	- Things like “single‑argument block definition” errors in `variables.tf` forced me to pay attention to Terraform syntax and formatting.
	- I moved from compact one‑liners to clearer multi‑line blocks.

- **Testing AWS interactions**
	- Using `aws-sdk-client-mock` let me focus on behaviour instead of wiring to real AWS.
	- Tests assert not only the HTTP responses, but also the **shape of the commands** sent to DynamoDB and EventBridge.

These are the kinds of issues you only really hit when you build something slightly “real” rather than following a script.

---

## How to run it (locally)

### Prerequisites

- Node.js 18+
- npm
- Terraform (if you want to deploy to AWS)
- `zip` (for packaging Lambdas)

### Install dependencies

```bash
cd flight-events
npm install

for dir in app/{get-flight,ingest,persist,worker}; do
	(cd "$dir" && npm install)
done
```

### Run tests

```bash
# Shared libs
cd app/lib
node --test tests/*.test.js

# Lambdas
cd ../get-flight   && node --test tests/*.test.js
cd ../ingest       && node --test tests/*.test.js
cd ../persist      && node --test tests/*.test.js
cd ../worker       && node --test tests/*.test.js
```

### Build deployment zips

```bash
cd flight-events
./scripts/build_zips.sh
```

Zips will appear under `terraform/zips/` and are used by Terraform for Lambda deployments.

---

## Deploying (Terraform + AWS)

If you have AWS credentials configured:

```bash
cd terraform
terraform init
terraform apply
```

Terraform will:

- Create the API Gateway HTTP API
- Create the Lambdas, EventBridge bus and rules, DynamoDB table, SQS queue, and IAM roles
- Output the API URL and resource names

You can then:

- `POST /events` to send flight updates.
- `GET /flights/{id}` to retrieve a specific flight.
- `GET /flights` to list all flights.

---

