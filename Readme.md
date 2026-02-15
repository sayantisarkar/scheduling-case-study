# Workshop Booking Availability Engine

A high-precision scheduling service designed to calculate vehicle maintenance availability across multiple workshops. The engine respects complex constraints including bay capabilities, sequential job dependencies, and multi-day workshop stays.

## 🏗️ Architectural Overview

### 1. The "Greedy Search" Scheduling Algorithm

Unlike a simple slot-finder, this service implements a **Greedy Search Algorithm with Horizon Bound (60 days)**.

* **Sequential Integrity**: Each job in a sequence (e.g., MOT → ADR → Axels) is scheduled starting exactly at the finish time of the previous job.
* **Multi-Day Carryover**: If a job sequence exceeds the daily working hours of a workshop, the engine automatically carries the remainder of the "Execution Plan" over to the next available working day.
* **Bay Hopping**: The engine allows for "Bay Hopping"—moving a vehicle between different specialized bays within the same workshop to achieve the earliest possible completion time.

### 2. Dependency Management

The engine features an **Implicit Dependency Resolver**. If a user requests a repair that requires a specific service (e.g., "Body Repair" requiring an "SWP" check), the engine automatically expands the execution plan to include the required service, ensuring business rules are enforced at the API level.

### 3. Modular Monolith Design

The project follows a strict separation of concerns:

* **API Layer**: Controllers handle validation and HTTP concerns.
* **Service Layer**: Orchestrates the data flow and prepares the final API response.
* **Domain Layer**: The `AvailabilityEngine` remains pure and contains the core scheduling logic.
* **Infrastructure Layer**: Repositories handle data access, making it easy to swap the JSON config for a database in the future.

## 🛠️ Technical Stack

* **Runtime**: Node.js (ESM / NodeNext)
* **Language**: TypeScript (Strict Mode)
* **Framework**: Express.js
* **Configuration**: Dotenv (12-Factor App compliance)

## 🚀 Getting Started

1. **Install Dependencies**:
```bash
npm install

```


2. **Configuration**:
Create a `.env` file in the root directory:
```text
PORT=5050
CONFIG_PATH=./data/workshops.config.json

```


3. **Run Development Mode**:
```bash
npm run dev

```



## 🧪 Testing the Scenarios

### 1. Sequential Multi-Day Test (The 15-Hour Plan)

**Request**: `POST /api/availability`

```json
{
  "services": ["MOT", "ADR", "CFK"],
  "repairs": ["Axels"]
}

```

**Expected**: The engine will distribute these 15 hours across 2-3 days (depending on weekend/closed days), providing a detailed `schedule` array for each job.

## ⚖️ Trade-offs & Production Scaling

* **In-Memory Repository**: To meet the 48-hour deadline, the system uses an in-memory repository for workshop configurations. In production, this would be replaced with **Amazon DynamoDB** for sub-second retrieval of global workshop states.
* **Atomic Scheduling**: The current engine is a "Query" service. In a full production environment, this would be integrated with an **Event-Driven Architecture** (using AWS EventBridge) to "lock" slots once a booking is confirmed.
* **Observability**: Structured JSON logging is implemented to ensure seamless integration with **AWS CloudWatch** or **Datadog**.

## 🛡️ Production Readiness

* **Graceful Shutdown**: Listens for `SIGTERM`/`SIGINT` to prevent request loss.
* **Security**: Input validation layer prevents malformed payloads from reaching the engine.
* **Cloud Ready**: Decoupled from hardcoded ports and paths via environment variables.