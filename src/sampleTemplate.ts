export const SAMPLE_TEMPLATE = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Approval request</title>
  </head>
  <body style="margin:0; padding:24px; background:#f4f5f7; font-family:Segoe UI, Arial, sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; border:1px solid #e1e4e8;">
      <tr>
        <td style="padding:20px 24px; background:#0f6cbd; border-radius:8px 8px 0 0; color:#ffffff; font-size:18px; font-weight:600;">
          Purchase order @{outputs('Get_item')?['body/PONumber']}
        </td>
      </tr>
      <tr>
        <td style="padding:24px; color:#24292f; font-size:14px; line-height:1.6;">
          <p style="margin:0 0 16px;">Hello @{outputs('Get_manager')?['body/displayName']},</p>

          <p style="margin:0 0 16px;">
            A new request was submitted by
            <strong>@{triggerOutputs()?['body/Requestor/DisplayName']}</strong>
            on @{formatDateTime(utcNow(), 'dd MMM yyyy')}.
          </p>

          <table role="presentation" cellpadding="8" cellspacing="0" width="100%" style="border-collapse:collapse; font-size:14px;">
            <tr style="background:#f6f8fa;">
              <td style="border:1px solid #e1e4e8; font-weight:600;">Item</td>
              <td style="border:1px solid #e1e4e8; font-weight:600;">Value</td>
            </tr>
            <tr>
              <td style="border:1px solid #e1e4e8;">Cost centre</td>
              <td style="border:1px solid #e1e4e8;">@{outputs('Get_item')?['body/CostCentre/Value']}</td>
            </tr>
            <tr>
              <td style="border:1px solid #e1e4e8;">Amount</td>
              <td style="border:1px solid #e1e4e8;">@{formatNumber(outputs('Get_item')?['body/Amount'], 'C2', 'en-GB')}</td>
            </tr>
          </table>

          <p style="margin:20px 0 0;">
            <a href="@{outputs('Get_item')?['body/ApprovalLink']}"
               style="display:inline-block; padding:10px 18px; background:#0f6cbd; color:#ffffff; text-decoration:none; border-radius:4px;">
              Review request
            </a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px; background:#f6f8fa; border-radius:0 0 8px 8px; color:#57606a; font-size:12px;">
          Sent by flow @{workflow()?['name']} &mdash; run @{workflow()?['run']['name']}
        </td>
      </tr>
    </table>
  </body>
</html>
`
