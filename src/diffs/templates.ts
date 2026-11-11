import type { DiffFile, TechTag } from '../types';
import { makeFile } from './parseDiff';

export const REACT_FILES: DiffFile[] = [
  makeFile(
    'src/components/ExecutionStream.tsx',
    `
@@ -1,18 +1,27 @@
 import { useEffect, useRef } from 'react';
-import { fetchEvents } from '../api/events';
+import { subscribe } from '../api/stream';
+import type { StreamEvent } from '../types';
 
-export function ExecutionStream({ agentId }) {
-  const [events, setEvents] = useState([]);
+interface Props {
+  agentId: string;
+  autoScroll?: boolean;
+}
+
+export function ExecutionStream({ agentId, autoScroll = true }: Props) {
+  const [events, setEvents] = useState<StreamEvent[]>([]);
   const listRef = useRef<HTMLDivElement>(null);
 
   useEffect(() => {
-    const id = setInterval(async () => {
-      setEvents(await fetchEvents(agentId));
-    }, 2000);
-    return () => clearInterval(id);
+    const unsubscribe = subscribe(agentId, (evt) => {
+      setEvents((prev) => [...prev.slice(-199), evt]);
+    });
+    return unsubscribe;
   }, [agentId]);
 
+  useEffect(() => {
+    if (autoScroll) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
+  }, [events, autoScroll]);
+
   return (
     <div ref={listRef} className="stream">`,
  ),
  makeFile(
    'src/api/stream.ts',
    `
@@ -0,0 +1,14 @@
+import type { StreamEvent } from '../types';
+
+type Listener = (evt: StreamEvent) => void;
+
+export function subscribe(agentId: string, listener: Listener): () => void {
+  const source = new EventSource(\`/v1/agents/\${agentId}/stream\`);
+  source.onmessage = (msg) => listener(JSON.parse(msg.data) as StreamEvent);
+  source.onerror = () => {
+    console.warn('[stream] reconnecting', agentId);
+  };
+  return () => source.close();
+}
+
+export default subscribe;`,
    'added',
  ),
];

export const PYTHON_FILES: DiffFile[] = [
  makeFile(
    'app/api/routes/webhooks.py',
    `
@@ -4,21 +4,31 @@ from fastapi import APIRouter, Header, HTTPException, Request
 from app.services.dispatcher import enqueue_delivery
+from app.services.signing import verify_signature
 
 router = APIRouter(prefix="/v1/hooks")
 
 
 @router.post("/ingest", status_code=202)
-async def ingest(request: Request):
+async def ingest(
+    request: Request,
+    x_agentpulse_signature: str = Header(...),
+    x_agentpulse_timestamp: str = Header(...),
+):
     body = await request.body()
-    payload = json.loads(body)
-    if not payload.get("event"):
-        raise HTTPException(400, "missing event")
+    if not verify_signature(body, x_agentpulse_timestamp, x_agentpulse_signature):
+        raise HTTPException(status_code=401, detail="invalid signature")
+
+    payload = json.loads(body)
+    event = payload.get("event")
+    if event not in SUPPORTED_EVENTS:
+        raise HTTPException(status_code=422, detail=f"unsupported event: {event}")
+
     delivery = await enqueue_delivery(payload)
-    return {"ok": True}
+    return {"status": "accepted", "delivery_id": delivery.id}`,
  ),
  makeFile(
    'app/services/signing.py',
    `
@@ -0,0 +1,16 @@
+import hashlib
+import hmac
+import time
+
+from app.config import settings
+
+TOLERANCE_SECONDS = 300
+
+
+def verify_signature(body: bytes, timestamp: str, header: str) -> bool:
+    if abs(time.time() - int(timestamp)) > TOLERANCE_SECONDS:
+        return False
+    message = timestamp.encode() + b"." + body
+    expected = hmac.new(settings.webhook_secret.encode(), message, hashlib.sha256).hexdigest()
+    received = header.removeprefix("sha256=")
+    return hmac.compare_digest(expected, received)`,
    'added',
  ),
];

export const DOCKER_FILES: DiffFile[] = [
  makeFile(
    'Dockerfile',
    `
@@ -1,12 +1,19 @@
-FROM node:18
+FROM node:20-alpine AS builder
 WORKDIR /app
-COPY . .
-RUN npm install
+COPY package*.json ./
+RUN npm ci --ignore-scripts
+COPY . .
 RUN npm run build
-EXPOSE 3000
-CMD ["npm", "start"]
+
+FROM node:20-alpine AS runtime
+WORKDIR /app
+ENV NODE_ENV=production
+COPY --from=builder /app/dist ./dist
+COPY --from=builder /app/node_modules ./node_modules
+USER node
+EXPOSE 3000
+HEALTHCHECK CMD wget -qO- http://localhost:3000/healthz || exit 1
+CMD ["node", "dist/server.js"]`,
  ),
  makeFile(
    '.github/workflows/ci.yml',
    `
@@ -14,9 +14,17 @@ jobs:
     steps:
       - uses: actions/checkout@v4
-      - run: npm install
-      - run: npm test
+      - uses: actions/setup-node@v4
+        with:
+          node-version: 20
+          cache: npm
+      - run: npm ci
+      - run: npm run lint
+      - run: npm test -- --coverage
+      - name: Build image
+        run: docker build -t agentpulse:\${{ github.sha }} .
       - name: Upload coverage
         uses: codecov/codecov-action@v4`,
  ),
];

export function filesForTags(tags: TechTag[]): DiffFile[] {
  const files: DiffFile[] = [];
  if (tags.includes('React') || tags.includes('TypeScript')) files.push(...REACT_FILES);
  if (tags.includes('Python') || tags.includes('Postgres') || tags.includes('Go')) files.push(...PYTHON_FILES);
  if (tags.includes('Docker') || tags.includes('Kubernetes')) files.push(...DOCKER_FILES);
  return files.length ? files : [...REACT_FILES.slice(0, 1), ...PYTHON_FILES.slice(1)];
}
