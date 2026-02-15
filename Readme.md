# Workshop Booking Availability Service

A high-performance, **modular monolith** backend service designed to calculate vehicle maintenance availability across multiple workshops within a 60-day window.

## 🏗️ Architectural Decisions

### 1. Modular Monolith Mindset

The project is structured with clear domain boundaries. By separating the **API Layer** (Controllers), **Application Layer** (Services), and **Domain Layer** (Scheduling Engine), the core business logic remains independent of the delivery mechanism.


**Benefit**: This allows for easy testing and a seamless transition to a Serverless architecture (e.g., AWS Lambda) by swapping the Express controller for a native handler.



### 2. Multi-Day Sequential Scheduling

The engine implements a **look-ahead search algorithm** that respects the sequential nature of fleet maintenance.

* If a sequence of jobs (e.g., MOT + Body Repair) exceeds a single day's working hours, the system automatically "carries over" the remaining work to the next available slot.



### 3. Serverless-Aware & Cloud Ready

* 
**Twelve-Factor App**: Configuration is managed via environment variables (`dotenv`).


* **Graceful Shutdown**: The service listens for `SIGTERM` signals to finish inflight requests before exiting, ensuring zero-downtime deployments.
* **Structured Logging**: Logs are output in JSON format, optimized for ingestion by AWS CloudWatch or ELK stacks.

## 🛠️ Technical Stack

* 
**Runtime**: Node.js (ESM Mode) 


* 
**Language**: TypeScript (Strict Mode) 


* 
**Framework**: Express 


* 
**Testing**: Jest / ts-jest 



## 🚀 Getting Started

1. **Install Dependencies**:
```bash
npm install

```


2. **Environment Setup**:
Create a `.env` file in the root:
```text
PORT=3000
CONFIG_PATH=./data/workshops.config.json

```


3. **Run Development Mode**:
```bash
npm run dev

```


4. **Production Build**:
```bash
npm run build
npm start

```



## 🧪 API Usage

### Query Availability

**Endpoint**: `POST /api/availability` 

**Payload**:

```json
{
  "services": ["MOT", "SWP"],
  "repairs": ["Body"]
}

```

## ⚖️ Trade-offs & Assumptions

* 
**In-Memory Persistence**: For this case study, `workshops.config.json` is treated as a read-only repository. In a production environment, this would be replaced by a **DynamoDB** or **PostgreSQL** instance to handle real-time booking updates and state persistence.


* **First-Available-Bay Strategy**: The engine assigns the first bay that meets the capability and time requirements. While pragmatic for a startup MVP, a more advanced version could optimize for "Bay Specialization" to increase workshop throughput.
* 
**60-Day Search Window**: As per requirements, the search is bound to 60 days from the current execution date.



## ☁️ AWS Scaling & Production

To operate this at scale on AWS, the following strategy is recommended:

1. **Compute**: Deploy as an **AWS Lambda** function fronted by **Amazon API Gateway**. This offers sub-second scaling and a pay-per-request cost model.


2. 
**Storage**: Migrate workshop configurations to **DynamoDB** with Global Tables for low-latency access across regions.


3. **Caching**: Implement **Amazon ElastiCache (Redis)** to cache availability results for common queries, reducing compute overhead during peak periods.
4. **CI/CD**: Use **AWS CodePipeline** to automate the build, test, and deployment of the TypeScript code as a Lambda Layer.