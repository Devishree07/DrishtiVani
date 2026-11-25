FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    YOLO_OFFLINE=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libxcb1 \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first (--index-url prevents pulling 2.5GB CUDA wheels),
# then install requirements and replace GUI OpenCV with headless OpenCV for slim containers.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt && \
    pip uninstall -y opencv-python opencv-contrib-python && \
    pip install --no-cache-dir "opencv-contrib-python-headless>=4.8.0"

COPY diagram_engine /app/diagram_engine

EXPOSE 8001

CMD ["sh", "-c", "uvicorn diagram_engine.api:app --host 0.0.0.0 --port ${PORT:-8001}"]
