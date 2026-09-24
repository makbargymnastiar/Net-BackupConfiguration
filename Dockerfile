FROM python:3.12-slim

WORKDIR /app/node_manager

COPY node_manager/ /app/node_manager/

RUN pip install --no-cache-dir \
    flask \
    flask-bcrypt \
    requests \
    pyyaml \
    docker

ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=production

EXPOSE 5000

CMD ["python", "app.py"]
