const express = require('express');
const { TikTokLiveConnection } = require('tiktok-live-connector');

const app = express();
// Usa el puerto que te dé la nube (Render/Koyeb) o el 3000 si estás probando local
const PORT = process.env.PORT || 3000;

// ==========================================
// BASES DE DATOS TEMPORALES (MEMORIA)
// ==========================================
// Aquí guardaremos las listas de regalos separadas por cada streamer
// Ejemplo: colasDeEventos["streamer1"] = [{...}], colasDeEventos["streamer2"] = [{...}]
const colasDeEventos = {}; 
const conexionesActivas = {}; // Evita que nos conectemos 2 veces al mismo directo

// ==========================================
// 1. RUTA DE PING (Para tu pantalla de carga en Roblox)
// ==========================================
app.get('/ping', (req, res) => {
    res.status(200).send("Servidor despierto y listo");
});

// ==========================================
// 2. RUTA PARA CONECTAR (Roblox la llama cuando el streamer pone su nombre)
// ==========================================
app.get('/conectar/:username', (req, res) => {
    const username = req.params.username.toLowerCase();

    // Si ya lo estábamos escuchando, no hacemos doble conexión
    if (conexionesActivas[username]) {
        return res.json({ status: "ok", mensaje: "Ya conectado a este stream" });
    }

    // Le creamos una lista vacía exclusiva para este streamer
    colasDeEventos[username] = [];

    // Iniciamos la conexión con su usuario
    let conexion = new TikTokLiveConnection(username, {});

    conexion.connect().then(state => {
        console.log(`✅ Conectado al directo de @${username}`);
        conexionesActivas[username] = conexion; // Guardamos la conexión activa
        res.json({ status: "ok", mensaje: `Escuchando a ${username}` });
    }).catch(err => {
        console.error(`❌ Error al conectar con @${username}`);
        res.json({ status: "error", mensaje: "No se pudo conectar. ¿Está en vivo?" });
    });

    // --- EVENTOS EXCLUSIVOS DE ESTE STREAMER ---
    
    conexion.on('chat', data => {
        const espectador = data.user?.displayId || data.uniqueId || "Desconocido";
        const texto = data.content || data.comment || "";
        
        // Guardamos el evento en la cola específica de ESTE streamer
        colasDeEventos[username].push({
            tipo: "chat",
            espectador: espectador,
            texto: texto
        });
    });

    conexion.on('gift', data => {
        const espectador = data.user?.displayId || data.uniqueId || "Desconocido";
        const nombreRegalo = data.gift?.name || data.giftName || "Desconocido";
        const cantidad = data.gift?.repeat_count || 1; // Por si mandan x10 rosas de golpe

        colasDeEventos[username].push({
            tipo: "regalo",
            espectador: espectador,
            regalo: nombreRegalo.toLowerCase(),
            cantidad: cantidad
        });
    });
});

// ==========================================
// 3. RUTA DE LECTURA (El bucle constante de Roblox)
// ==========================================
app.get('/eventos/:username', (req, res) => {
    const username = req.params.username.toLowerCase();

    // Si existe una cola para este streamer, se la enviamos y la vaciamos
    if (colasDeEventos[username]) {
        res.json({ acciones: colasDeEventos[username] });
        colasDeEventos[username] = []; // Vaciamos para no repetir acciones en Roblox
    } else {
        // Si no hay nada o no se ha conectado, enviamos vacío
        res.json({ acciones: [] });
    }
});

// ==========================================
// ENCENDIDO DEL SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Servidor central activo en el puerto ${PORT}`);
});