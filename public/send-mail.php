<?php
/**
 * Script de procesamiento y envío de formularios web
 * Fincas Maricel, S.L. (comercial@fincasmaricel.com)
 *
 * Soporta:
 * - type = 'contacto'   (Página de contacto)
 * - type = 'tasacion'   (Pop-up de tasación gratuita en Venda)
 * - type = 'propiedad'  (Formulario de consulta en cada ficha de inmueble)
 * - type = 'newsletter' (Suscripción del footer)
 */

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Método no permitido. Solo se aceptan peticiones POST.'
    ]);
    exit;
}

// Destinatario principal
$destinatario_principal = 'comercial@fincasmaricel.com';

// Dominio del host actual para SPF / evitar carpeta de SPAM
$host = !empty($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : (!empty($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'fincasmaricel.com');
$host = preg_replace('/^www\./i', '', $host);
$host = explode(':', $host)[0];
$remitente_sistema = 'no-reply@' . $host;

// Comprobación anti-spam (honeypot invisible)
if (!empty($_POST['website_hp'])) {
    echo json_encode(['success' => true, 'message' => 'Mensaje recibido.']);
    exit;
}

// Sanitizar campos recibidos
$type           = isset($_POST['type']) ? strtolower(trim(strip_tags($_POST['type']))) : 'contacto';
$nombre         = isset($_POST['name']) ? trim(strip_tags($_POST['name'])) : '';
$email          = isset($_POST['email']) ? trim(filter_var($_POST['email'], FILTER_SANITIZE_EMAIL)) : '';
$phone          = isset($_POST['phone']) ? trim(strip_tags($_POST['phone'])) : '';
$topic          = isset($_POST['topic']) ? trim(strip_tags($_POST['topic'])) : '';
$reference      = isset($_POST['reference']) ? trim(strip_tags($_POST['reference'])) : '';
$property_title = isset($_POST['property_title']) ? trim(strip_tags($_POST['property_title'])) : '';
$mensaje        = isset($_POST['message']) ? trim(strip_tags($_POST['message'])) : '';

// Validaciones según tipo de formulario
$errores = [];

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errores[] = 'El correo electrónico no es válido.';
}

if ($type !== 'newsletter') {
    if (empty($nombre)) {
        $errores[] = 'El campo nombre es obligatorio.';
    }
    if ($type === 'contacto' && empty($phone)) {
        $errores[] = 'El teléfono es obligatorio.';
    }
    if ($type === 'propiedad' && empty($mensaje)) {
        $errores[] = 'Debe escribir un mensaje.';
    }
}

if (!empty($errores)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Por favor, revise los datos introducidos.',
        'errors'  => $errores
    ]);
    exit;
}

// Asunto según tipo de solicitud
switch ($type) {
    case 'newsletter':
        $titulo_correo = 'Nueva Suscripción a la Newsletter';
        $asunto_texto  = "Nueva Suscripción Newsletter: $email";
        break;
    case 'tasacion':
        $titulo_correo = 'Nueva Solicitud de Tasación Gratuita';
        $asunto_texto  = "Solicitud Tasación Gratuita: $nombre";
        break;
    case 'propiedad':
        $titulo_correo = 'Nueva Consulta sobre Propiedad';
        $ref_tag       = $reference ? " [Ref. $reference]" : '';
        $asunto_texto  = "Consulta Inmueble$ref_tag: $nombre";
        break;
    case 'contacto':
    default:
        $titulo_correo = 'Nueva Consulta desde la Web';
        $tema_tag      = $topic ? " ($topic)" : '';
        $asunto_texto  = "Nueva Consulta Web: $nombre$tema_tag";
        break;
}

$asunto = '=?UTF-8?B?' . base64_encode($asunto_texto) . '?=';

// Filas de datos para el HTML del email
$filas = '';
$addRow = function ($label, $value, $isAlt = false) use (&$filas) {
    if ($value === '') return;
    $bg = $isAlt ? 'background-color: #f8fafc;' : '';
    $filas .= '<tr style="' . $bg . ' border-bottom: 1px solid #e2e8f0;">
        <td width="35%" style="font-weight: bold; font-size: 14px; color: #475569; padding: 10px;">' . htmlspecialchars($label) . '</td>
        <td width="65%" style="font-size: 14px; color: #0f172a; padding: 10px;">' . $value . '</td>
    </tr>';
};

$addRow('Tipo de solicitud:', htmlspecialchars(ucfirst($type)), true);
if ($reference !== '') {
    $addRow('Referencia inmueble:', '<strong style="color:#9b1e2e;">' . htmlspecialchars($reference) . '</strong>', false);
}
if ($property_title !== '') {
    $addRow('Propiedad:', htmlspecialchars($property_title), true);
}
if ($nombre !== '') {
    $addRow('Nombre:', htmlspecialchars($nombre), false);
}
if ($email !== '') {
    $addRow('Correo electrónico:', '<a href="mailto:' . htmlspecialchars($email) . '" style="color: #9b1e2e; text-decoration: none;">' . htmlspecialchars($email) . '</a>', true);
}
if ($phone !== '') {
    $addRow('Teléfono:', '<a href="tel:' . htmlspecialchars($phone) . '" style="color: #9b1e2e; text-decoration: none;">' . htmlspecialchars($phone) . '</a>', false);
}
if ($topic !== '') {
    $addRow('Tema:', htmlspecialchars($topic), true);
}

$bloqueMensaje = '';
if ($mensaje !== '') {
    $bloqueMensaje = '
    <div style="background-color: #f8fafc; border-left: 4px solid #9b1e2e; padding: 15px; border-radius: 4px; margin-top: 20px;">
        <p style="margin: 0 0 8px; font-weight: bold; font-size: 14px; color: #475569;">Mensaje:</p>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-line;">' . htmlspecialchars($mensaje) . '</p>
    </div>';
}

$cuerpoHTML = '
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>' . htmlspecialchars($titulo_correo) . '</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #1e293b;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
        <tr>
            <td style="background-color: #444444; padding: 26px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 400; letter-spacing: 3px;">FINCAS MARICEL</h1>
                <p style="color: #e8b8b8; margin: 8px 0 0; font-size: 13px; letter-spacing: 1px;">' . htmlspecialchars($titulo_correo) . '</p>
            </td>
        </tr>
        <tr>
            <td style="padding: 30px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                    ' . $filas . '
                </table>
                ' . $bloqueMensaje . '
                <p style="margin-top: 28px; font-size: 12px; color: #94a3b8; text-align: center;">
                    Mensaje enviado automáticamente desde el formulario web de fincasmaricel.com
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
';

$messageId   = '<' . md5(uniqid(microtime(), true)) . '@' . $host . '>';
$fechaActual = date('r');
$replyName   = $nombre !== '' ? $nombre : $email;

$cabeceras   = [];
$cabeceras[] = 'Date: ' . $fechaActual;
$cabeceras[] = 'Message-ID: ' . $messageId;
$cabeceras[] = 'MIME-Version: 1.0';
$cabeceras[] = 'Content-type: text/html; charset=UTF-8';
$cabeceras[] = 'From: Fincas Maricel Web <' . $remitente_sistema . '>';
$cabeceras[] = 'Reply-To: ' . $replyName . ' <' . $email . '>';
$cabeceras[] = 'Return-Path: <' . $remitente_sistema . '>';
$cabeceras[] = 'X-Priority: 3';
$cabeceras[] = 'X-Mailer: PHP/' . phpversion();

$parametrosAdicionales = '-f ' . escapeshellarg($remitente_sistema);
$envio = @mail($destinatario_principal, $asunto, $cuerpoHTML, implode("\r\n", $cabeceras), $parametrosAdicionales);

if ($envio) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Mensaje enviado correctamente.'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'No fue posible enviar el correo en este momento. Por favor, contacte en el +34 938 94 32 47 o en comercial@fincasmaricel.com.'
    ]);
}

