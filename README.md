DIAGRAMA DEL PROYECTO 

flowchart TB
    subgraph CLIENTE["Cliente"]
        WEB["Interfaz web"]
        INTERNET["Acceso desde internet<br/>Explorar tiendas y filas"]
        QR["Código QR<br/>Acceso directo a una sucursal"]
        ADMIN["Panel de administrador<br/>Gestionar negocio y filas"]
    end

    subgraph BACKEND["Backend · Node.js + Express + TypeScript"]
        ROUTES["Routes<br/>Definición de endpoints"]
        MW["Middlewares<br/>Validación y manejo de errores"]

        subgraph CONTROLLERS["Controllers"]
            C1["Store Controller"]
            C2["Queue Controller"]
            C3["File Controller"]
        end

        subgraph SERVICES["Services"]
            S1["Store Service<br/>Consultar y registrar empresas"]
            S2["Queue Service<br/>Generar y gestionar turnos"]
            S3["File Service<br/>Gestionar logotipos"]
        end

        subgraph REPOSITORIES["Repositories"]
            R1["Store Repository"]
            R2["Queue Repository"]
            R3["File Repository"]
        end

        WS["WebSocket Handler<br/>Actualizaciones en tiempo real"]
        MODELS["Models / Schemas<br/>Mongoose"]
    end

    DB[("MongoDB<br/>Empresas, sucursales,<br/>turnos y URLs de logotipos")]

    INTERNET --> WEB
    QR --> WEB
    ADMIN --> WEB

    WEB -->|"HTTP / REST"| ROUTES
    ROUTES --> MW
    MW --> C1
    MW --> C2
    MW --> C3

    C1 --> S1
    C2 --> S2
    C3 --> S3

    S1 --> R1
    S2 --> R2
    S3 --> R3

    R1 --> MODELS
    R2 --> MODELS
    R3 --> MODELS
    MODELS --> DB

    S2 <--> WS
    WS <-->|"Eventos de actualización"| WEB

    classDef client fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
    classDef layer fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef storage fill:#fef3c7,stroke:#d97706,color:#78350f

    class WEB,INTERNET,QR,ADMIN client
    class ROUTES,MW,C1,C2,C3,S1,S2,S3,R1,R2,R3,WS,MODELS layer
    class DB storage