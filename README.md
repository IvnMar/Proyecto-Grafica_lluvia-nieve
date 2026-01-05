PROYECTO: SIMULACIÓN ATMOSFÉRICA Y ENTORNO URBANO PROCEDURAL Materia: Computación Gráfica Alumno: Meza Bravo Ivan Marcelino Tecnologías: Three.js, TypeScript, Vite, WebGL

DESCRIPCIÓN DEL PROYECTO

Este proyecto consiste en una simulación gráfica interactiva en tiempo real que representa fenómenos meteorológicos (lluvia y nieve) dentro de una ciudad generada por código (procedural).

El objetivo principal fue implementar técnicas de optimización gráfica como "Instanced Rendering" y "Object Pooling" para renderizar miles de partículas simultáneas manteniendo 60 cuadros por segundo (FPS) estables en navegadores web. Incluye sistemas dinámicos como ciclo día/noche, tráfico autónomo y peatones con inteligencia artificial reactiva.

CARACTERÍSTICAS PRINCIPALES

Sistema de Clima Optimizado

Implementación de mallas instanciadas para renderizar hasta 10,000 partículas de lluvia o nieve en una sola llamada de dibujo.

Lógica de reciclaje de partículas para que la memoria no se sature.

Texturas generadas en tiempo real para lluvia y nieve que se ven bien incluso de noche.

Ciudad Procedural

Generación automática de edificios con variaciones de altura, color y tipos de techo (dos aguas, escalonados).

Zonificación urbana lógica: Carreteras para coches, aceras para gente y un parque central con lago.

Iluminación dinámica: Farolas y ventanas que se encienden automáticamente cuando oscurece.

IA y Sistemas Dinámicos

Ciclo Día/Noche: Transición suave de iluminación ambiental y color de niebla.

Tráfico: Vehículos autónomos que respetan carriles y proyectan luces (faros) de noche.

Población: Peatones que caminan por zonas seguras y abren paraguas automáticamente cuando llueve.

CONTROLES E INTERACCIÓN

Clic Izquierdo + Arrastrar: Rotar la cámara alrededor de la escena.

Rueda del Ratón: Acercar o alejar (Zoom).

Tecla 'C': Cambiar entre Cámara Perspectiva y Cámara Ortográfica.

Tecla 'I': Ejecutar Auditoría Técnica (Ver resultados de rendimiento en la Consola F12).

Panel Derecho (GUI): Controlar el tipo de clima, velocidad del tiempo, viento y hora del día.

INSTRUCCIONES DE INSTALACIÓN Y EJECUCIÓN

Para correr este proyecto en tu computadora, necesitas tener instalado Node.js.

Clonar el repositorio: git clone https://github.com/IvnMar/Proyecto-Grafica_lluvia-nieve.git cd Proyecto-Grafica_lluvia-nieve

Instalar las dependencias necesarias: npm install

Iniciar el servidor de desarrollo: npm run dev

Abrir en el navegador: Entra a la dirección que aparece en la pantalla (usualmente es http://localhost:5173).

AUDITORÍA Y RENDIMIENTO

El proyecto incluye una herramienta de depuración interna para validar la optimización. Al presionar la tecla 'I' dentro de la simulación, se imprime en la consola del navegador un reporte del uso de memoria de la GPU, confirmando la eficiencia del mallado.
