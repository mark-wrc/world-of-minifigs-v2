import {
  FileText,
  Package,
  CreditCard,
  Truck,
  RotateCcw,
  Copyright,
  AlertTriangle,
  Scale,
  UserCheck,
  Mail,
  MapPin,
  CheckCircle2,
  FileCheck,
} from "lucide-react";
import { APP_EMAIL, APP_ADDRESS, APP_COMPANY_NAME } from "@/constant/appConfig";

export const termsMetadata = {
  title: "Terms of Use",
  lastUpdated: "Last Updated: March 1, 2025",
  cta: {
    title: "Contact Us",
    message:
      "If you have any questions or concerns about this Terms of Use, please contact us via email",
    company: {
      companyName: APP_COMPANY_NAME,
      address: APP_ADDRESS,
      icon: MapPin,
    },
    email: {
      email: APP_EMAIL,
      emailPath: `mailto: ${APP_EMAIL}`,
      icon: Mail,
    },
  },
};

export const termsData = {
  termsSectionsWithItems: [
    {
      id: "product",
      title: "Product Information and Authenticity",
      description:
        "We provide the following guarantees regarding our products:",
      items: [
        {
          label: "Authentic LEGO Parts:",
          text: "We guarantee that all LEGO parts, minifigure pieces, heads, torsos, and other products sold on this website are authentic LEGO products.",
        },
        {
          label: "Product Descriptions:",
          text: "We make every effort to provide accurate descriptions and images of our products. However, we do not warrant that the descriptions, images, or other content on this website are accurate, complete, reliable, current, or error-free.",
        },
        {
          label: "Availability:",
          text: "Product availability is subject to change without notice.",
        },
      ],
      icon: Package,
    },
    {
      id: "orders",
      title: "Orders and Payment",
      description:
        "The following terms apply to all orders placed on our website:",
      items: [
        {
          label: "Order Acceptance:",
          text: "Your order constitutes an offer to purchase our products. We reserve the right to accept or reject any order for any reason.",
        },
        {
          label: "Payment:",
          text: "Payment must be made in full at the time of purchase. We accept [List accepted payment methods, e.g., credit cards, PayPal].",
        },
        {
          label: "Pricing:",
          text: "Prices are subject to change without notice. We are not responsible for typographical errors regarding pricing or product information.",
        },
        {
          label: "Sales Tax:",
          text: "Applicable sales tax will be added to your order based on your shipping address and the prevailing laws of Utah.",
        },
      ],
      icon: CreditCard,
    },
    {
      id: "shipping",
      title: "Shipping and Delivery",
      description:
        "We strive to deliver your orders in a timely manner. Please review the following shipping terms:",
      items: [
        {
          label: "Shipping:",
          text: "We will ship your order to the address provided during checkout. Shipping times may vary.",
        },
        {
          label: "Risk of Loss:",
          text: "The risk of loss and title for all items purchased from us pass to you upon our delivery to the carrier.",
        },
        {
          label: "International Shipping:",
          text: "If we offer international shipping, you are responsible for any customs duties, taxes, and fees.",
        },
      ],
      icon: Truck,
    },
    {
      id: "returns",
      title: "Returns and Refunds",
      description:
        "We want you to be satisfied with your purchase. Our return and refund policy is as follows:",
      items: [
        {
          label: "Return Policy:",
          text: "Returns are accepted within 30 days of receipt for unopened items. Customers are responsible for return shipping.",
        },
        {
          label: "Refunds:",
          text: "Refunds will be issued to the original payment method.",
        },
        {
          label: "Damaged or Defective Items:",
          text: "If you receive a damaged or defective item, please contact us immediately.",
        },
      ],
      icon: RotateCcw,
    },
    {
      id: "ip",
      title: "Intellectual Property",
      description:
        "All intellectual property rights related to this website and our products are protected. Please review the following:",
      items: [
        {
          label: "Copyright:",
          text: "All content on this website, including text, images, logos, and designs, is the property of World of Minifigs or its licensors and is protected by copyright laws.",
        },
        {
          label: "Trademarks:",
          text: '"World of Minifigs" and our logo are trademarks of World of Minifigs/Brick Extreme. You may not use our trademarks without our prior written consent.',
        },
        {
          label: "LEGO Trademarks:",
          text: "LEGO, the LEGO logo, the Minifigure, and the Brick and Knob configurations are trademarks of the LEGO Group of Companies, which does not sponsor, authorize, or endorse this site.",
        },
      ],
      icon: Copyright,
    },
    {
      id: "conduct",
      title: "User Conduct",
      description:
        "By using this website, you agree to the following terms of conduct:",
      items: [
        {
          text: "You agree not to use this website for any unlawful purpose.",
        },
        {
          text: "You agree not to upload or transmit any harmful or malicious code.",
        },
        {
          text: "You agree not to interfere with the operation of this website.",
        },
      ],
      icon: UserCheck,
    },
  ],
  termsDescriptionOnly: [
    {
      id: "acceptance",
      title: "Acceptance of Terms",
      description:
        "Your use of this website constitutes your acceptance of these Terms. We reserve the right to modify these Terms at any time. Any changes will be posted on this page, and your continued use of the website after such changes have been posted will constitute your acceptance of the revised Terms.",
      icon: FileText,
    },
    {
      id: "liability",
      title: "Limitation of Liability",
      description:
        "To the fullest extent permitted by law, World of Minifigs shall not be liable for any direct, indirect, incidental, consequential, or punitive damages arising from your use of this website or the purchase of our products. In no event shall our total liability to you for all damages, losses, or causes of action exceed the amount paid by you for the products in question.",
      icon: AlertTriangle,
    },
    {
      id: "governing",
      title: "Governing Law and Jurisdiction",
      description:
        "These Terms shall be governed by and construed following the laws of the State of Utah, without regard to its conflict of law principles. Any dispute arising out of or relating to these Terms shall be subject to the exclusive jurisdiction of the state and federal courts located in Lehi, Utah.",
      icon: Scale,
    },
    {
      id: "severability",
      title: "Severability",
      description:
        "If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall continue to be valid and enforceable.",
      icon: CheckCircle2,
    },
    {
      id: "entire",
      title: "Entire Agreement",
      description:
        "These Terms constitute the entire agreement between you and World of Minifigs concerning the use of this website and the purchase of our products.",
      icon: FileCheck,
    },
  ],
};
