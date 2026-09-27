"""
email_service.py — Email invitation delivery and formatting for TripSync Group Trips.
Integrates with SMTP or Resend if configured via environment variables.
Provides a clear service boundary, template generator, and configuration reporting.
"""

import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any, Optional

logger = logging.getLogger("tripsync.email_service")

# Environment variables for email configuration
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL") or os.getenv("SMTP_USER") or "noreply@tripsync.travel"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def is_email_provider_configured() -> bool:
    """Check if an outbound SMTP or email service is configured."""
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def generate_invitation_email_html(
    trip_name: str,
    starting_city: str,
    destination: str,
    start_date: str,
    end_date: str,
    organizer_name: str,
    invitation_token: str,
    recipient_email: str
) -> Dict[str, str]:
    """
    Generate professional HTML and plain text invitation emails.
    Includes Trip Details, Organizer Name, and explicit Accept/Decline action buttons.
    """
    base_url = FRONTEND_URL.rstrip("/")
    accept_url = f"{base_url}/invite/{invitation_token}?action=accept"
    decline_url = f"{base_url}/invite/{invitation_token}?action=decline"
    preview_url = f"{base_url}/invite/{invitation_token}"

    subject = f"✈️ You're invited to join '{trip_name}' by {organizer_name}"

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trip Invitation — {trip_name}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 24px;
    }}
    .card {{
      max-width: 560px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }}
    .header {{
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #ffffff;
      padding: 32px 28px;
      text-align: center;
    }}
    .header h1 {{
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }}
    .header p {{
      margin: 8px 0 0 0;
      font-size: 13px;
      opacity: 0.9;
    }}
    .content {{
      padding: 28px;
    }}
    .badge {{
      display: inline-block;
      background-color: #e0f2fe;
      color: #0369a1;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }}
    .trip-meta {{
      background-color: #f1f5f9;
      border-radius: 14px;
      padding: 16px;
      margin: 18px 0;
    }}
    .meta-row {{
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
      border-bottom: 1px dashed #cbd5e1;
    }}
    .meta-row:last-child {{
      border-bottom: none;
    }}
    .meta-label {{
      color: #64748b;
      font-weight: 600;
    }}
    .meta-val {{
      color: #0f172a;
      font-weight: 700;
    }}
    .question {{
      text-align: center;
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin: 24px 0 16px 0;
    }}
    .actions {{
      display: flex;
      gap: 12px;
      justify-content: center;
      margin: 20px 0;
    }}
    .btn {{
      display: inline-block;
      text-decoration: none;
      padding: 12px 22px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 700;
      text-align: center;
      transition: all 0.2s;
    }}
    .btn-accept {{
      background-color: #10b981;
      color: #ffffff;
    }}
    .btn-decline {{
      background-color: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
    }}
    .footer {{
      background-color: #f8fafc;
      padding: 16px 28px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge" style="background:#ffffff; color:#0369a1;">TripSync Invitation</span>
      <h1>{trip_name}</h1>
      <p>Organized by <strong>{organizer_name}</strong></p>
    </div>
    <div class="content">
      <p style="font-size: 14px; line-height: 1.5; margin: 0;">
        Hello, you've been invited by <strong>{organizer_name}</strong> to join the travel group for an upcoming adventure on <strong>TripSync</strong>.
      </p>

      <div class="trip-meta">
        <div class="meta-row">
          <span class="meta-label">Route</span>
          <span class="meta-val">{starting_city} &rarr; {destination}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Dates</span>
          <span class="meta-val">{start_date or 'TBD'} to {end_date or 'TBD'}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Invited Member</span>
          <span class="meta-val">{recipient_email}</span>
        </div>
      </div>

      <div class="question">Do you want to join this trip?</div>

      <div class="actions">
        <a href="{accept_url}" class="btn btn-accept">✓ Yes, I want to join</a>
        <a href="{decline_url}" class="btn btn-decline">✗ No, I decline</a>
      </div>

      <p style="text-align: center; font-size: 11px; color: #64748b; margin-top: 12px;">
        You can also review the itinerary before deciding: <a href="{preview_url}" style="color: #0284c7; font-weight: 600;">View Trip Details</a>
      </p>
    </div>
    <div class="footer">
      TripSync • One trip. Every booking. One intelligent recovery.<br>
      This invitation was generated for {recipient_email}.
    </div>
  </div>
</body>
</html>
"""

    text_content = f"""Trip Invitation: {trip_name}
Organized by: {organizer_name}

Route: {starting_city} -> {destination}
Dates: {start_date} to {end_date}

Do you want to join this trip?

- Yes, I want to join: {accept_url}
- No, I decline: {decline_url}

View Trip Details: {preview_url}

Sent by TripSync for {recipient_email}.
"""

    return {
        "subject": subject,
        "html": html_content,
        "text": text_content,
        "accept_url": accept_url,
        "decline_url": decline_url,
        "preview_url": preview_url,
    }


async def send_invitation_email(
    trip_name: str,
    starting_city: str,
    destination: str,
    start_date: str,
    end_date: str,
    organizer_name: str,
    invitation_token: str,
    recipient_email: str
) -> Dict[str, Any]:
    """
    Sends the group invitation email via SMTP if configured,
    or logs and returns the full payload and simulation URLs when unconfigured.
    """
    email_data = generate_invitation_email_html(
        trip_name=trip_name,
        starting_city=starting_city,
        destination=destination,
        start_date=start_date,
        end_date=end_date,
        organizer_name=organizer_name,
        invitation_token=invitation_token,
        recipient_email=recipient_email
    )

    configured = is_email_provider_configured()

    if not configured:
        logger.info(
            f"[EMAIL SERVICE NOT CONFIGURED] Group invitation created for {recipient_email} "
            f"on trip '{trip_name}'. Token: {invitation_token}. "
            f"Accept Link: {email_data['accept_url']}"
        )
        return {
            "sent": False,
            "provider_configured": False,
            "recipient": recipient_email,
            "subject": email_data["subject"],
            "accept_url": email_data["accept_url"],
            "decline_url": email_data["decline_url"],
            "preview_url": email_data["preview_url"],
            "html_preview": email_data["html"],
            "message": (
                "SMTP provider is not configured in environment variables. "
                "The invitation was securely created in the database and an interactive preview is available."
            ),
            "required_env_vars": [
                "SMTP_HOST",
                "SMTP_PORT",
                "SMTP_USER",
                "SMTP_PASSWORD",
                "SMTP_FROM_EMAIL",
                "FRONTEND_URL"
            ]
        }

    # If configured, send via SMTP
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = email_data["subject"]
        msg["From"] = SMTP_FROM_EMAIL
        msg["To"] = recipient_email

        part1 = MIMEText(email_data["text"], "plain")
        part2 = MIMEText(email_data["html"], "html")
        msg.attach(part1)
        msg.attach(part2)

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, [recipient_email], msg.as_string())

        logger.info(f"Successfully sent invitation email to {recipient_email} via SMTP {SMTP_HOST}")
        return {
            "sent": True,
            "provider_configured": True,
            "provider": "smtp",
            "recipient": recipient_email,
            "subject": email_data["subject"],
            "accept_url": email_data["accept_url"],
            "decline_url": email_data["decline_url"],
            "preview_url": email_data["preview_url"],
            "message": f"Invitation email sent to {recipient_email}."
        }
    except Exception as e:
        logger.error(f"Failed to send email via SMTP: {e}")
        return {
            "sent": False,
            "provider_configured": True,
            "recipient": recipient_email,
            "error": str(e),
            "accept_url": email_data["accept_url"],
            "decline_url": email_data["decline_url"],
            "preview_url": email_data["preview_url"],
            "html_preview": email_data["html"],
            "message": f"SMTP delivery failed: {str(e)}"
        }
