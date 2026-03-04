# 🚀 Deployment Instructions (VPS + Docker)

Since you are using Docker on your VPS (like for n8n), deploying this API is straightforward.

## 1. Upload Files to VPS
Copy the backend folder to your VPS. The easiest way is to clone the repository:

```bash
git clone https://github.com/Tioecomp/sankhya-backend.git
cd sankhya-backend
```

**Files needed:**
- `Dockerfile`
- `docker-compose.yml`
- `package.json` / `package-lock.json`
- `server.js`
- `sankhyaService.js`
- `.env` (IMPORTANT: Create this on the server with your credentials)

## 2. Configure Environment (.env)
Create a `.env` file in the project folder on your VPS:
```bash
nano .env
```
Paste your credentials:
```ini
SANKHYA_BASE_URL=https://api.sankhya.com.br
SANKHYA_CLIENT_ID=YOUR_APP_KEY
SANKHYA_CLIENT_SECRET=YOUR_SECRET
SANKHYA_TOKEN=YOUR_TOKEN
PORT=3000
```

## 3. Run with Docker Compose
Navigate to the folder and run:

```bash
docker-compose up -d --build
```
- `-d`: Detached mode (runs in background)
- `--build`: Forces rebuild of the image

## 4. Verify Status
Check if it's running:
```bash
docker ps
```
View logs if needed:
```bash
docker logs -f sankhya-api
```

## 5. Endpoints (Live)
If your VPS IP is `123.45.67.89` (and port 3000 follows firewall rules):

- **Preço (POST):** `http://123.45.67.89:3000/api/preco`
  - Body: `{ "codigo": 397, "tabela": 6 }`

- **Nota Fiscal (POST):** `http://123.45.67.89:3000/api/fiscal`
  - Body: `{ "numero_nota": 23534 }`
