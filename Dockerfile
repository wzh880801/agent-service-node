FROM node:18.20.4
RUN mkdir /repos
RUN mkdir /repos/agent-service-node
COPY . /repos/agent-service-node
WORKDIR /repos/agent-service-node
RUN npm i pm2@latest -g --registry=https://registry.npmmirror.com/
RUN npm i --registry=https://registry.npmmirror.com/
RUN chmod +x ./start.sh
ENTRYPOINT [ "./start.sh" ]