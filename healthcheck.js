// Healthcheck para o Railway verificar se o bot está rodando
const http = require('http');

const options = {
    hostname: 'localhost',
    port: process.env.PORT || 3000,
    path: '/health',
    method: 'GET',
    timeout: 5000
};

const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
        console.log('Healthcheck: OK');
        process.exit(0);
    } else {
        console.log(`Healthcheck: Falha (status ${res.statusCode})`);
        process.exit(1);
    }
});

req.on('error', (err) => {
    console.log('Healthcheck: Erro de conexão');
    process.exit(1);
});

req.on('timeout', () => {
    console.log('Healthcheck: Timeout');
    req.destroy();
    process.exit(1);
});

req.end();
