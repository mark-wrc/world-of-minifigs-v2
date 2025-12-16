import {
  Mail,
  FileText,
  MapPin,
  Lock,
  Clock,
  Baby,
  RefreshCw,
  Cookie,
  Share2,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { APP_EMAIL, APP_ADDRESS, APP_COMPANY_NAME } from "@/constant/appConfig";

export const policyMetadata = {
  title: "Privacy Policy",
  lastUpdated: "Last Updated: March 1, 2025",
  cta: {
    title: "Contact Us",
    message:
      "If you have any questions or concerns about this Privacy Policy, please contact us via email",
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

export const policyData = {
  informationWeCollect: {
    title: "Information We Collect",
    description:
      "We collect various types of information to provide and improve our services. The information we collect includes:",
    icon: FileText,
    sections: [
      {
        title: "Personal Information",
        items: [
          "Name",
          "Shipping and billing address",
          "Email address",
          "Phone number",
          "Payment information (processed by our secure payment processors)",
        ],
      },
      {
        title: "Order Information",
        items: [
          "Details of the products you purchase",
          "Order history",
          "Shipping information",
        ],
      },
      {
        title: "Website Usage Information",
        items: [
          "IP address",
          "Browser type",
          "Device information",
          "Pages visited",
          "Cookies and similar technologies (see section 3)",
        ],
      },
      {
        title: "Communication Information",
        items: [
          "Information you provide when you contact us with inquiries or support requests",
          "Information provided when you subscribe to our newsletter",
        ],
      },
    ],
  },
  policySectionsWithItems: [
    {
      title: "Sharing Your Information",
      description:
        "We may share your information with the following third parties:",
      items: [
        {
          label: "Service Providers:",
          text: "We share information with third-party service providers who assist us with payment processing, shipping, website hosting, and other services.",
        },
        {
          label: "Payment Processors:",
          text: "We use secure payment processors to process your payments. We do not store your credit card information on our servers.",
        },
        {
          label: "Shipping Carriers:",
          text: "We share your shipping information with shipping carriers to deliver your orders.",
        },
        {
          label: "Legal Compliance:",
          text: "We may share your information when required by law or to protect our rights and interests.",
        },
        {
          label: "Business Transfers:",
          text: "Your information may be transferred to the acquiring entity in the event of a merger, acquisition, or sale of assets.",
        },
      ],
      icon: Share2,
    },
    {
      title: "Cookies and Similar Technologies",
      description:
        "We use cookies to collect website usage information and enhance your browsing experience. Cookies are small data files stored on your device that allow us to:",
      items: [
        {
          label: "Remember your preferences",
        },
        {
          label: "Track website traffic",
        },
        {
          label: "Analyze website performance",
        },
        {
          label: "Personalize your experience",
        },
      ],
      icon: Cookie,
    },
    {
      title: "How We Use Your Information",
      description:
        "We use the information we collect for various purposes to provide, maintain, and improve our services:",
      items: [
        {
          label: "To Process and Fulfill Orders:",
          text: "To process your orders, ship products, and provide order updates.",
        },
        {
          label: "To Provide Customer Support:",
          text: "To respond to your inquiries, resolve issues, and provide assistance.",
        },
        {
          label: "To Improve Our Services:",
          text: "To analyze website usage, improve our products and services, and enhance user experience.",
        },
        {
          label: "To Communicate with You:",
          text: "To send order confirmations, shipping updates, promotional emails (with your consent), and important notices.",
        },
        {
          label: "To Prevent Fraud and Ensure Security:",
          text: "To protect against fraud, unauthorized transactions, and other security risks.",
        },
        {
          label: "To Comply with Legal Obligations:",
          text: "To comply with applicable laws and regulations.",
        },
      ],
      icon: Settings,
    },
    {
      title: "Your Rights",
      description:
        "You have the following rights regarding your personal information:",
      items: [
        {
          label: "Access:",
          text: "You can request access to the personal information we hold about you.",
        },
        {
          label: "Correction:",
          text: "You can request to correct any inaccurate or incomplete information.",
        },
        {
          label: "Deletion:",
          text: "You can request to delete your personal information, subject to legal limitations.",
        },
        {
          label: "Opt-Out:",
          text: "You can opt out of receiving promotional emails by following the unsubscribe instructions in the emails.",
        },
        {
          label: "Data Portability:",
          text: "You can request a copy of your personal data in a machine-readable format.",
        },
      ],
      icon: ShieldCheck,
    },
  ],
  policyDescriptionOnly: [
    {
      title: "Data Security",
      description:
        "We take reasonable measures to protect your information from unauthorized access, use, or disclosure. However, no method of transmission over the Internet or electronic storage is completely secure.",
      icon: Lock,
    },
    {
      title: "Data Retention",
      description:
        "We retain your information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law.",
      icon: Clock,
    },
    {
      title: "Children's Privacy",
      description:
        "Our website is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.",
      icon: Baby,
    },
    {
      title: "Changes to This Privacy Policy",
      description:
        "We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on our website. Your continued use of our website after the changes are posted constitutes your acceptance of the updated policy.",
      icon: RefreshCw,
    },
  ],
};
