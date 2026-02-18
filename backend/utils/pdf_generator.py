from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from datetime import datetime
from io import BytesIO
import os

def generate_invoice_pdf(invoice_data, items_data, client_data, company_data):
    """
    Generate a professional PDF invoice
    
    Args:
        invoice_data: Invoice details dict
        items_data: List of invoice items
        client_data: Client information dict
        company_data: Company/freelancer information dict
    
    Returns:
        BytesIO: PDF file buffer
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72,
                           topMargin=72, bottomMargin=18)
    
    # Container for PDF elements
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=28,
        textColor=colors.HexColor('#4361EE'),
        spaceAfter=12,
        alignment=TA_LEFT,
        fontName='Helvetica-Bold'
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#4361EE'),
        spaceAfter=6,
        fontName='Helvetica-Bold'
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6
    )
    
    # Header - Company Name and Invoice Title
    elements.append(Paragraph("ClientNudge AI", title_style))
    elements.append(Paragraph(company_data.get('name', 'Company Name'), heading_style))
    elements.append(Paragraph(company_data.get('email', ''), normal_style))
    elements.append(Spacer(1, 0.3*inch))
    
    # Invoice Number and Status
    invoice_header_data = [
        ['INVOICE', invoice_data['invoice_number']],
        ['Status', invoice_data['status'].upper()],
        ['Date', datetime.fromisoformat(invoice_data['created_at'].replace('Z', '+00:00')).strftime('%B %d, %Y')],
        ['Due Date', datetime.fromisoformat(invoice_data['due_date'].replace('Z', '+00:00')).strftime('%B %d, %Y')]
    ]
    
    invoice_header_table = Table(invoice_header_data, colWidths=[2*inch, 3*inch])
    invoice_header_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#4361EE')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(invoice_header_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Bill To Section
    elements.append(Paragraph('BILL TO', heading_style))
    elements.append(Paragraph(client_data['name'], normal_style))
    if client_data.get('company'):
        elements.append(Paragraph(client_data['company'], normal_style))
    elements.append(Paragraph(client_data['email'], normal_style))
    if client_data.get('phone'):
        elements.append(Paragraph(client_data['phone'], normal_style))
    elements.append(Spacer(1, 0.3*inch))
    
    # Invoice Items Table
    elements.append(Paragraph('ITEMS', heading_style))
    elements.append(Spacer(1, 0.1*inch))
    
    currency_symbol = get_currency_symbol(invoice_data['currency'])
    
    # Table header
    items_table_data = [['Description', 'Quantity', 'Rate', 'Amount']]
    
    # Table rows
    for item in items_data:
        items_table_data.append([
            item['description'],
            str(item['quantity']),
            f"{currency_symbol}{item['rate']:.2f}",
            f"{currency_symbol}{item['amount']:.2f}"
        ])
    
    items_table = Table(items_table_data, colWidths=[3*inch, 1*inch, 1.2*inch, 1.2*inch])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4361EE')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')])
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Totals Section
    totals_data = [
        ['Subtotal:', f"{currency_symbol}{invoice_data['subtotal']:.2f}"]
    ]
    
    if invoice_data['discount_amount'] > 0:
        discount_label = f"Discount ({invoice_data['discount_value']}{'%' if invoice_data['discount_type'] == 'percentage' else ' ' + invoice_data['currency']}):"
        totals_data.append([discount_label, f"-{currency_symbol}{invoice_data['discount_amount']:.2f}"])
    
    if invoice_data['tax_amount'] > 0:
        totals_data.append([f"Tax ({invoice_data['tax_percentage']}%):", f"{currency_symbol}{invoice_data['tax_amount']:.2f}"])
    
    if invoice_data['late_fee_amount'] > 0:
        totals_data.append(['Late Fee:', f"{currency_symbol}{invoice_data['late_fee_amount']:.2f}"])
    
    totals_data.append(['', ''])  # Spacer
    totals_data.append(['TOTAL DUE:', f"{currency_symbol}{invoice_data['total_amount']:.2f}"])
    
    totals_table = Table(totals_data, colWidths=[4.4*inch, 1.8*inch])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 14),
        ('FONTSIZE', (0, 0), (-1, -2), 10),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#4361EE')),
        ('LINEABOVE', (0, -1), (-1, -1), 2, colors.HexColor('#4361EE')),
        ('TOPPADDING', (0, -1), (-1, -1), 12),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 0.5*inch))
    
    # Payment Instructions
    elements.append(Paragraph('PAYMENT INSTRUCTIONS', heading_style))
    payment_text = f"""Please make payment before the due date to avoid late fees. 
    You can pay securely online through our client portal using the invoice link provided in your email.
    
    For questions about this invoice, please contact {company_data.get('email', '')}."""
    elements.append(Paragraph(payment_text, normal_style))
    elements.append(Spacer(1, 0.3*inch))
    
    # Footer
    footer_text = "Thank you for your business!"
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.grey,
        alignment=TA_CENTER
    )
    elements.append(Spacer(1, 0.5*inch))
    elements.append(Paragraph(footer_text, footer_style))
    elements.append(Paragraph("Generated by ClientNudge AI", footer_style))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer

def get_currency_symbol(code):
    """Get currency symbol from code"""
    symbols = {
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'INR': '₹',
        'AED': 'د.إ',
        'CAD': 'C$'
    }
    return symbols.get(code, '$')
