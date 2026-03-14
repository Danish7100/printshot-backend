# Finding Bearer Token Configuration on Raspberry Pi

## Run these commands on your Raspberry Pi:

### 1. Find all Python files
```bash
find ~ -name "*.py" -type f 2>/dev/null | grep -E "(print|server|api|upload)"
```

### 2. Search for bearer token in all files
```bash
grep -r "bearer\|BEARER\|token\|TOKEN" ~ 2>/dev/null | grep -v ".git" | head -20
```

### 3. Check common locations
```bash
# Check home directory
ls -la ~/
cat ~/.env 2>/dev/null
cat ~/config.py 2>/dev/null
cat ~/print_server.py 2>/dev/null

# Check if running as service
sudo systemctl list-units | grep -E "print|upload"
```

### 4. Find running Python processes
```bash
ps aux | grep python
```

### 5. Check environment variables of running process
```bash
# Get the PID from step 4, then:
sudo cat /proc/[PID]/environ | tr '\0' '\n' | grep -i token
```

### 6. Common file locations to check:
```bash
cat /home/pi/print_server.py 2>/dev/null
cat /home/pi/app.py 2>/dev/null
cat /home/pi/.env 2>/dev/null
cat /opt/print_service/config.py 2>/dev/null
cat /etc/print_service/.env 2>/dev/null
```

### 7. If using Docker:
```bash
docker ps
docker inspect [container_name] | grep -i token
```

## What to look for:

The token configuration will look like one of these:

**Python:**
```python
BEARER_TOKEN = "some_token_here"
API_TOKEN = "some_token_here"
AUTH_TOKEN = "some_token_here"
```

**Environment file (.env):**
```
BEARER_TOKEN=some_token_here
API_TOKEN=some_token_here
```

**Flask/FastAPI:**
```python
@app.before_request
def check_token():
    token = request.headers.get('Authorization')
    if token != 'Bearer expected_token_here':
        return jsonify({'error': 'Invalid token'}), 401
```

## Once you find it:

Replace the old token with:
```
609ffe15ac7e0d1732b5e632f598a7a48687e74d44acf94ef53c0068121cd6fa
```

Then restart the service:
```bash
sudo systemctl restart [service_name]
# or
sudo reboot
```
