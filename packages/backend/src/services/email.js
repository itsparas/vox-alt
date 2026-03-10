/**
 * Email Service
 * Handles email notifications for calls, bookings, and system events
 */

import nodemailer from 'nodemailer';
import config from '../config/index.js';
import { logger } from '../lib/logger.js';

const log = logger.child({ service: 'email' });

// Email transporter (initialized lazily)
let transporter = null;

/**
 * Initialize email transporter
 */
function getTransporter() {
  if (transporter) return transporter;

  if (config.email.provider === 'sendgrid' && config.email.sendgrid?.apiKey) {
    // Using SendGrid SMTP relay
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: config.email.sendgrid.apiKey,
      },
    });
  } else {
    // Using standard SMTP
    transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
      auth: config.email.smtp.user ? {
        user: config.email.smtp.user,
        pass: config.email.smtp.password,
      } : undefined,
    });
  }

  return transporter;
}

/**
 * Send an email
 */
async function sendEmail({ to, subject, html, text }) {
  try {
    const transport = getTransporter();
    
    const result = await transport.sendMail({
      from: `"${config.email.fromName}" <${config.email.from}>`,
      to,
      subject,
      html,
      text,
    });

    log.info('Email sent', { to, subject, messageId: result.messageId });
    return result;
  } catch (error) {
    log.error('Failed to send email', { error: error.message, to, subject });
    throw error;
  }
}

/**
 * Send booking confirmation email
 */
export async function sendBookingConfirmation(booking, tenantConfig) {
  if (!booking.contactEmail) {
    log.debug('No contact email for booking confirmation', { bookingId: booking.id });
    return;
  }

  const startDate = new Date(booking.startTime);
  const businessName = tenantConfig?.businessName || 'Our Business';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Confirmed</h1>
        </div>
        <div class="content">
          <p>Hello ${booking.contactName || 'there'},</p>
          <p>Your appointment with ${businessName} has been confirmed!</p>
          
          <div class="details">
            <p><strong>Date:</strong> ${startDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Time:</strong> ${startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
            <p><strong>Duration:</strong> ${booking.durationMinutes || 30} minutes</p>
            ${booking.title ? `<p><strong>Service:</strong> ${booking.title}</p>` : ''}
          </div>

          <p>If you need to reschedule or cancel, please contact us.</p>
          
          <p>Thank you for choosing ${businessName}!</p>
        </div>
        <div class="footer">
          <p>This is an automated message from VoxReception.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Booking Confirmed

Hello ${booking.contactName || 'there'},

Your appointment with ${businessName} has been confirmed!

Date: ${startDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Time: ${startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
Duration: ${booking.durationMinutes || 30} minutes
${booking.title ? `Service: ${booking.title}` : ''}

If you need to reschedule or cancel, please contact us.

Thank you for choosing ${businessName}!
  `;

  return sendEmail({
    to: booking.contactEmail,
    subject: `Appointment Confirmed - ${businessName}`,
    html,
    text,
  });
}

/**
 * Send escalation notification to agents
 */
export async function sendEscalationNotification(agents, callDetails, tenantConfig) {
  const businessName = tenantConfig?.businessName || 'VoxReception';
  
  for (const agent of agents) {
    if (!agent.email) continue;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .cta { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Call Escalated</h1>
          </div>
          <div class="content">
            <p>Hello ${agent.displayName || agent.email},</p>
            <p>A call has been escalated and requires immediate attention.</p>
            
            <div class="details">
              <p><strong>Caller:</strong> ${callDetails.callerName || 'Unknown'}</p>
              <p><strong>Phone:</strong> ${callDetails.callerPhone || 'N/A'}</p>
              <p><strong>Reason:</strong> ${callDetails.reason || 'Customer requested human assistance'}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <p style="text-align: center;">
              <a href="${config.frontendUrl}/dashboard/agent" class="cta">Join Call Now</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
URGENT: Call Escalated

Hello ${agent.displayName || agent.email},

A call has been escalated and requires immediate attention.

Caller: ${callDetails.callerName || 'Unknown'}
Phone: ${callDetails.callerPhone || 'N/A'}
Reason: ${callDetails.reason || 'Customer requested human assistance'}
Time: ${new Date().toLocaleString()}

Join the call at: ${config.frontendUrl}/dashboard/agent
    `;

    try {
      await sendEmail({
        to: agent.email,
        subject: `⚠️ Call Escalated - ${businessName}`,
        html,
        text,
      });
    } catch (error) {
      log.error('Failed to send escalation email', { agentId: agent.id, error: error.message });
    }
  }
}

/**
 * Send missed call notification
 */
export async function sendMissedCallNotification(users, callDetails, tenantConfig) {
  const businessName = tenantConfig?.businessName || 'VoxReception';
  
  for (const user of users) {
    if (!user.email) continue;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #F59E0B; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📞 Missed Call</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You received a missed call through ${businessName}.</p>
            
            <div class="details">
              <p><strong>Caller:</strong> ${callDetails.callerName || 'Unknown'}</p>
              <p><strong>Phone:</strong> ${callDetails.callerPhone || 'N/A'}</p>
              <p><strong>Time:</strong> ${new Date(callDetails.createdAt).toLocaleString()}</p>
              ${callDetails.notes ? `<p><strong>Message:</strong> ${callDetails.notes}</p>` : ''}
            </div>

            <p>Please follow up with the caller at your earliest convenience.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: `Missed Call - ${businessName}`,
        html,
        text: `Missed Call from ${callDetails.callerName || 'Unknown'} at ${new Date(callDetails.createdAt).toLocaleString()}`,
      });
    } catch (error) {
      log.error('Failed to send missed call email', { userId: user.id, error: error.message });
    }
  }
}

/**
 * Send daily summary email
 */
export async function sendDailySummary(user, summary, tenantConfig) {
  if (!user.email) return;

  const businessName = tenantConfig?.businessName || 'VoxReception';
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat { text-align: center; padding: 15px; background: white; border-radius: 8px; min-width: 100px; }
        .stat-value { font-size: 24px; font-weight: bold; color: #4F46E5; }
        .stat-label { font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Daily Summary</h1>
          <p>${date}</p>
        </div>
        <div class="content">
          <p>Hello ${user.displayName || 'there'},</p>
          <p>Here's your daily summary for ${businessName}:</p>
          
          <div class="stats">
            <div class="stat">
              <div class="stat-value">${summary.totalCalls || 0}</div>
              <div class="stat-label">Total Calls</div>
            </div>
            <div class="stat">
              <div class="stat-value">${summary.answeredCalls || 0}</div>
              <div class="stat-label">Answered</div>
            </div>
            <div class="stat">
              <div class="stat-value">${summary.bookingsCreated || 0}</div>
              <div class="stat-label">Bookings</div>
            </div>
          </div>

          <p>Average call duration: ${summary.avgDuration || 0} minutes</p>
          <p>Escalated calls: ${summary.escalatedCalls || 0}</p>

          <p style="text-align: center; margin-top: 20px;">
            <a href="${config.frontendUrl}/dashboard" style="color: #4F46E5;">View Full Dashboard →</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: user.email,
    subject: `Daily Summary - ${businessName} - ${date}`,
    html,
    text: `Daily Summary for ${date}\nTotal Calls: ${summary.totalCalls || 0}\nAnswered: ${summary.answeredCalls || 0}\nBookings: ${summary.bookingsCreated || 0}`,
  });
}

export default {
  sendEmail,
  sendBookingConfirmation,
  sendEscalationNotification,
  sendMissedCallNotification,
  sendDailySummary,
};
