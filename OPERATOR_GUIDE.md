# VoxReception Operator Guide

This guide covers production deployment, configuration, scaling, monitoring, and troubleshooting for VoxReception.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Production Deployment](#production-deployment)
3. [Database Management](#database-management)
4. [Security Configuration](#security-configuration)
5. [Scaling](#scaling)
6. [Monitoring & Observability](#monitoring--observability)
7. [Backup & Recovery](#backup--recovery)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 20 GB SSD | 100+ GB SSD |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements

- Docker 24.0+ and Docker Compose v2
- Kubernetes 1.28+ (for K8s deployment)
- PostgreSQL 15+
- Redis 7+
- Node.js 18.x (for local development)

### External Services

- **LiveKit Cloud** or self-hosted LiveKit server
- **Stripe** account for billing
- **OpenAI** API key for LLM
- **Deepgram** API key for ASR
- **ElevenLabs** or AWS Polly for TTS
- **Google Cloud** service account (for Calendar integration)

---

## Production Deployment

### Docker Compose Deployment

1. **Prepare secrets**
   ```bash
   # Create secrets file
   cat > .env.prod << EOF
   # Database
   POSTGRES_USER=voxreception
   POSTGRES_PASSWORD=$(openssl rand -base64 32)
   POSTGRES_DB=voxreception
   DATABASE_URL=postgresql://voxreception:${POSTGRES_PASSWORD}@postgres:5432/voxreception
   
   # Redis
   REDIS_PASSWORD=$(openssl rand -base64 32)
   REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
   
   # JWT
   JWT_SECRET=$(openssl rand -base64 64)
   JWT_REFRESH_SECRET=$(openssl rand -base64 64)
   
   # LiveKit
   LIVEKIT_API_KEY=your-api-key
   LIVEKIT_API_SECRET=your-api-secret
   LIVEKIT_URL=wss://livekit.yourdomain.com
   
   # Stripe
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   
   # OpenAI
   OPENAI_API_KEY=sk-...
   
   # Deepgram
   DEEPGRAM_API_KEY=...
   
   # ElevenLabs
   ELEVENLABS_API_KEY=...
   EOF
   ```

2. **Deploy with production compose file**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Run database migrations**
   ```bash
   docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
   ```

4. **Verify deployment**
   ```bash
   # Check service health
   curl http://localhost:3001/health
   
   # Check all containers
   docker-compose -f docker-compose.prod.yml ps
   ```

### Kubernetes Deployment

#### Using Kustomize

1. **Create namespace and secrets**
   ```bash
   # Create namespace
   kubectl create namespace voxreception
   
   # Create secrets
   kubectl create secret generic voxreception-secrets \
     --from-literal=database-url='postgresql://...' \
     --from-literal=redis-url='redis://...' \
     --from-literal=jwt-secret='...' \
     --from-literal=stripe-secret-key='...' \
     --from-literal=openai-api-key='...' \
     -n voxreception
   ```

2. **Apply base configuration**
   ```bash
   kubectl apply -k k8s/base/
   ```

3. **Verify deployment**
   ```bash
   kubectl get pods -n voxreception
   kubectl get svc -n voxreception
   kubectl get ingress -n voxreception
   ```

#### Production Overlay

Create a production overlay for environment-specific configuration:

```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: voxreception

resources:
  - ../../base

patches:
  - target:
      kind: Deployment
      name: backend
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 3
  - target:
      kind: Deployment
      name: frontend
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 2

images:
  - name: voxreception/backend
    newTag: v1.0.0
  - name: voxreception/frontend
    newTag: v1.0.0
```

#### LiveKit on Kubernetes

LiveKit requires special configuration for WebRTC:

```yaml
# k8s/livekit/deployment.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: livekit
spec:
  selector:
    matchLabels:
      app: livekit
  template:
    spec:
      hostNetwork: true  # Required for WebRTC
      containers:
        - name: livekit
          image: livekit/livekit-server:latest
          ports:
            - containerPort: 7880
            - containerPort: 7881
            - containerPort: 7882
              protocol: UDP
          env:
            - name: LIVEKIT_CONFIG
              valueFrom:
                configMapKeyRef:
                  name: livekit-config
                  key: config.yaml
```

---

## Database Management

### Connection Pooling

For production, use PgBouncer for connection pooling:

```yaml
# docker-compose.prod.yml addition
pgbouncer:
  image: edoburu/pgbouncer:1.21.0
  environment:
    DATABASE_URL: postgresql://voxreception:password@postgres:5432/voxreception
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 1000
    DEFAULT_POOL_SIZE: 25
  ports:
    - "6432:5432"
```

### Migrations

```bash
# Create migration
npx prisma migrate dev --name add_feature

# Deploy migration (production)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Reset database (CAUTION: destroys data)
npx prisma migrate reset
```

### Seeding Data

```bash
# Seed database with initial data
npx prisma db seed
```

### Backup Strategy

Use `pg_dump` for PostgreSQL backups:

```bash
# Full backup
pg_dump -h localhost -U voxreception -Fc voxreception > backup_$(date +%Y%m%d).dump

# Restore
pg_restore -h localhost -U voxreception -d voxreception backup_20240101.dump
```

Automated backup script:

```bash
#!/bin/bash
# /opt/scripts/backup.sh

BACKUP_DIR=/backups/postgres
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup
pg_dump -h postgres -U voxreception -Fc voxreception > ${BACKUP_DIR}/backup_${TIMESTAMP}.dump

# Upload to S3 (optional)
aws s3 cp ${BACKUP_DIR}/backup_${TIMESTAMP}.dump s3://your-bucket/backups/

# Clean old backups
find ${BACKUP_DIR} -name "backup_*.dump" -mtime +${RETENTION_DAYS} -delete
```

---

## Security Configuration

### TLS/SSL

1. **Obtain certificates** (Let's Encrypt recommended)
   ```bash
   certbot certonly --standalone -d api.voxreception.com -d app.voxreception.com
   ```

2. **Configure nginx for TLS**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name api.voxreception.com;
       
       ssl_certificate /etc/letsencrypt/live/api.voxreception.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/api.voxreception.com/privkey.pem;
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
       
       location / {
           proxy_pass http://backend:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### Rate Limiting

Configure rate limits in nginx:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

server {
    location /api/auth {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://backend:3001;
    }
    
    location /api {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://backend:3001;
    }
}
```

### Security Headers

Already configured in Next.js and Express, but verify with:

```bash
# Check security headers
curl -I https://api.voxreception.com/health
```

Expected headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: ...`

### Secrets Management

For Kubernetes, use sealed-secrets or external secrets operator:

```bash
# Install sealed-secrets
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Create sealed secret
kubeseal --format yaml < secret.yaml > sealed-secret.yaml
```

---

## Scaling

### Horizontal Pod Autoscaling

HPA is configured in `k8s/base/backend.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Database Scaling

For high-load scenarios, consider:

1. **Read replicas** for read-heavy workloads
2. **Connection pooling** with PgBouncer
3. **Partitioning** for large tables (calls, transcripts)

```sql
-- Partition calls table by tenant and date
CREATE TABLE calls (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    created_at TIMESTAMP,
    ...
) PARTITION BY RANGE (created_at);

CREATE TABLE calls_2024_q1 PARTITION OF calls
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
```

### Redis Clustering

For high availability:

```yaml
# redis-cluster.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-cluster-config
data:
  redis.conf: |
    cluster-enabled yes
    cluster-config-file nodes.conf
    cluster-node-timeout 5000
    appendonly yes
```

---

## Monitoring & Observability

### Prometheus Metrics

Metrics are exposed at `/metrics` endpoint:

```yaml
# prometheus-servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: voxreception-backend
spec:
  selector:
    matchLabels:
      app: backend
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
```

### Key Metrics to Monitor

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `http_requests_total` | Total HTTP requests | - |
| `http_request_duration_seconds` | Request latency | p99 > 1s |
| `active_calls_total` | Active calls | > 80% capacity |
| `asr_latency_seconds` | ASR processing time | p95 > 500ms |
| `tts_latency_seconds` | TTS processing time | p95 > 500ms |
| `llm_latency_seconds` | LLM response time | p95 > 2s |
| `db_connections_active` | Active DB connections | > 80% pool |

### Grafana Dashboards

Import pre-built dashboards:

```bash
# Copy dashboard JSON files to Grafana provisioning
cp dashboards/*.json /etc/grafana/provisioning/dashboards/
```

### Alerting Rules

```yaml
# prometheus-rules.yaml
groups:
  - name: voxreception
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          
      - alert: HighLatency
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High request latency
          
      - alert: DatabaseConnectionsHigh
        expr: pg_stat_activity_count > 80
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: Database connections running high
```

### Logging

Logs are structured JSON via Winston. Configure log aggregation:

```yaml
# fluentd-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/voxreception-*.log
      pos_file /var/log/fluentd-containers.log.pos
      tag kubernetes.*
      <parse>
        @type json
      </parse>
    </source>
    
    <match kubernetes.**>
      @type elasticsearch
      host elasticsearch
      port 9200
      logstash_format true
      logstash_prefix voxreception
    </match>
```

---

## Backup & Recovery

### Automated Backups

1. **Database backups** (daily)
2. **Redis RDB snapshots** (hourly)
3. **Configuration backups** (on change)

### Kubernetes Backup with Velero

```bash
# Install Velero
velero install --provider aws --bucket your-bucket --secret-file ./credentials

# Create backup schedule
velero schedule create voxreception-daily \
  --schedule="0 2 * * *" \
  --include-namespaces voxreception

# Manual backup
velero backup create voxreception-backup --include-namespaces voxreception

# Restore
velero restore create --from-backup voxreception-backup
```

### Disaster Recovery

1. **RTO (Recovery Time Objective)**: 1 hour
2. **RPO (Recovery Point Objective)**: 15 minutes

Recovery steps:
1. Provision new infrastructure
2. Restore database from latest backup
3. Apply Kubernetes manifests
4. Restore Redis data (if cached data is critical)
5. Update DNS to point to new infrastructure

---

## Troubleshooting

### Common Issues

#### Backend won't start

```bash
# Check logs
docker logs voxreception-backend

# Common causes:
# 1. Database not ready - wait or check connection string
# 2. Migrations not run - run prisma migrate deploy
# 3. Missing env vars - check all required variables
```

#### LiveKit connection issues

```bash
# Verify LiveKit is accessible
curl http://livekit:7880/rtc

# Check WebSocket connectivity
wscat -c ws://livekit:7880/rtc

# For K8s, ensure hostNetwork: true
kubectl get pods -o yaml | grep hostNetwork
```

#### High memory usage

```bash
# Check for memory leaks
node --inspect backend/src/index.js

# Monitor in Chrome DevTools
chrome://inspect

# Common causes:
# 1. Uncleared intervals/timeouts
# 2. Event listener leaks
# 3. Large response caching
```

#### Database performance

```sql
-- Find slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check connection count
SELECT count(*) FROM pg_stat_activity;

-- Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle' AND query_start < NOW() - INTERVAL '1 hour';
```

#### Redis issues

```bash
# Check Redis memory
redis-cli INFO memory

# Check connected clients
redis-cli CLIENT LIST

# Clear specific cache
redis-cli DEL "tenant:*:config"
```

### Debug Mode

Enable debug logging:

```bash
# Set log level
LOG_LEVEL=debug npm start

# Enable specific debug namespaces
DEBUG=vox:* npm start
```

### Health Check Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Basic health check |
| `GET /health/ready` | Readiness check (DB, Redis) |
| `GET /health/live` | Liveness check |
| `GET /metrics` | Prometheus metrics |

### Support Escalation

1. Check logs and metrics dashboards
2. Review recent deployments
3. Check upstream service status (Stripe, OpenAI, etc.)
4. Contact support with:
   - Error logs (sanitized)
   - Timestamp of issue
   - Steps to reproduce
   - Environment details

---

## Maintenance Tasks

### Regular Maintenance

| Task | Frequency | Command |
|------|-----------|---------|
| Clear expired tokens | Daily | `npx prisma db execute --file=scripts/cleanup-tokens.sql` |
| Archive old transcripts | Weekly | `npm run archive:transcripts` |
| Database vacuum | Weekly | `VACUUM ANALYZE;` |
| Update dependencies | Monthly | `npm update` |
| Rotate secrets | Quarterly | See secrets management |
| Review access logs | Monthly | Manual review |

### Upgrade Procedure

1. Review changelog and breaking changes
2. Test in staging environment
3. Create database backup
4. Deploy with rolling update
5. Monitor for errors
6. Rollback if necessary

```bash
# Rolling update in Kubernetes
kubectl set image deployment/backend backend=voxreception/backend:v1.1.0

# Rollback if needed
kubectl rollout undo deployment/backend
```

---

## Contact

- **On-call**: oncall@voxreception.com
- **Engineering**: engineering@voxreception.com
- **Status Page**: https://status.voxreception.com
