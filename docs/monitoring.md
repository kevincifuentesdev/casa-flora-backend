# Monitoreo local con Prometheus, Grafana y ELK

El backend expone métricas Prometheus en `/metrics` (también `/api/metrics`) y
genera logs JSON con los campos `@timestamp`, `level`, `message` y
`application`. Cuando `LOGSTASH_HOST` está configurado, cada línea se envía por
TCP al puerto `LOGSTASH_PORT` (por defecto `5001`).

## Configuración

En el `.env` local:

```env
APPLICATION_NAME=casa-flora-backend
LOGSTASH_HOST=127.0.0.1
LOGSTASH_PORT=5001
```

Agrega el job de `monitoring/prometheus/prometheus.yml` al archivo
`prometheus.yml` del stack compartido, sin eliminar el job de Java. Reinicia
Prometheus y confirma que ambos targets aparezcan como `UP`.

Importa `monitoring/grafana/casa-flora-dashboard.json` en Grafana y selecciona
la fuente de datos Prometheus. El dashboard contiene paneles de tasa de
peticiones, latencia p95 y solicitudes en vuelo.

El pipeline compartido de Logstash debe aceptar JSON por TCP en `5001` y
conservar `@timestamp` como campo de tiempo. El campo `application` permite
crear el índice `casa-flora-backend-AAAA.MM.DD`.

## Evidencia reproducible

Con la API y el stack levantados, genera tráfico y ambos niveles de log:

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/monitoring/info
curl -i http://localhost:4000/api/monitoring/error
curl http://localhost:4000/metrics
curl http://localhost:9200/_cat/indices?v
```

En Kibana crea un Data View `casa-flora-backend-*` y otro combinado con el
patrón de la aplicación Java. En Discover filtra
`application:"casa-flora-backend"` para mostrar los eventos `INFO` y `ERROR`.
