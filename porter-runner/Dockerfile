FROM rust:1.95-bookworm AS porter-build
RUN apt-get update && apt-get install -y --no-install-recommends git pkg-config libdbus-1-dev libsecret-1-dev && rm -rf /var/lib/apt/lists/*
ARG PORTER_COMMIT=940364806bd41d9c4b4f076a08668485a85b9395
RUN git clone https://github.com/kevinbonomi2-bit/horizon-porter.git /src \
    && git -C /src checkout "$PORTER_COMMIT" \
    && cargo build --locked --release --manifest-path /src/Cargo.toml -p porter-cli

FROM python:3.12-slim AS runtime
COPY --from=eclipse-temurin:21-jre /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="/opt/java/openjdk/bin:$PATH"
RUN apt-get update && apt-get install -y --no-install-recommends libdbus-1-3 libsecret-1-0 && rm -rf /var/lib/apt/lists/*
COPY --from=porter-build /src/target/release/horizon-porter /usr/local/bin/horizon-porter
WORKDIR /app
COPY porter-runner/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY porter-runner/app.py ./app.py
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
