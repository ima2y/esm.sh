# Build Stage
FROM golang:1.22-alpine AS build-stage

# Set the working directory inside the container
WORKDIR /tmp/esm.sh

# Copy local source code into the container
COPY . .

# Build the project
RUN apk update && apk add --no-cache git
RUN CGO_ENABLED=0 GOOS=linux go build -o esmd main.go

# Release Stage
FROM node:22-alpine AS release-stage

RUN apk update && apk add --no-cache git git-lfs libcap-utils
RUN git lfs install
RUN npm i -g pnpm

# Copy the binary from the build stage
COPY --from=build-stage /tmp/esm.sh/esmd /bin/esmd

# Set permissions and capabilities
RUN setcap cap_net_bind_service=ep /bin/esmd
RUN chown node:node /bin/esmd

# Set the user and working directory
USER node
WORKDIR /tmp

# Expose the port
EXPOSE 8080

# Run the binary
CMD ["esmd"]
