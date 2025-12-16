import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  contactHero,
  contactChannels,
  contactFaqs,
} from "@/constant/contactData";
import { useSendContactMessageMutation } from "@/redux/api/userApi";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    consent: false,
  });

  const [sendContact, { isLoading }] = useSendContactMessageMutation();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleConsentChange = (checked) => {
    setFormData((prev) => ({ ...prev, consent: !!checked }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required", {
        description: "Please enter your name.",
      });
      return false;
    }

    if (!formData.email.trim()) {
      toast.error("Email is required", {
        description: "Please enter your email address.",
      });
      return false;
    }

    if (!formData.message.trim()) {
      toast.error("Message is required", {
        description: "Please enter your message.",
      });
      return false;
    }

    if (!formData.consent) {
      toast.error("Terms & Privacy Policy not accepted", {
        description:
          "Please agree to the Terms and Privacy Policy to continue.",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const { name, email, subject, message } = formData;

    try {
      const response = await sendContact({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      }).unwrap();

      toast.success(response?.message || "Message sent", {
        description: response?.description || "Thank you for reaching out.",
      });

      setFormData({
        name: "",
        email: "",
        subject: "",
        message: "",
        consent: false,
      });
    } catch (error) {
      console.error("Contact form error:", error);

      toast.error(error?.data?.message || "Unable to send your message", {
        description:
          error?.data?.description ||
          "An unexpected error occurred while sending your message. Please try again later.",
      });
    }
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden py-40 border border-border/50">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-24 -left-24 w-64 h-64 md:w-96 md:h-96 rounded-full bg-accent" />
          <div className="absolute top-1/2 right-1/4 w-56 h-56 md:w-64 md:h-64 rounded-full bg-accent" />
          <div className="absolute -bottom-32 -right-32 w-52 h-52 md:w-64 md:h-64 rounded-full bg-accent" />
        </div>

        <div className="relative px-5 text-center">
          <h1 className="text-6xl font-bold mb-5">
            Get in <span className="text-accent">{contactHero.highlight}</span>
          </h1>
          <div className="mx-auto max-w-3xl">
            <p className="text-sm">{contactHero.description}</p>
          </div>
        </div>
      </section>

      {/* Main */}
      <section className="py-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 px-5">
          {/* Left: Form */}
          <Card className="md:col-span-2 shadow-none self-start">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">
                Send us a message
              </CardTitle>
            </CardHeader>

            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Enter your name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    placeholder="What is this regarding?"
                    value={formData.subject}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Write your message here..."
                    className="min-h-32"
                    value={formData.message}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="flex items-start gap-2 text-sm">
                  <Checkbox
                    id="consent"
                    name="consent"
                    checked={formData.consent}
                    onCheckedChange={handleConsentChange}
                    className="mt-0.5"
                  />
                  <p className="leading-relaxed">
                    By proceeding, you acknowledge that you have read,
                    understood, and agree to our{" "}
                    <Link to="/terms-of-use" className="font-medium underline">
                      Terms of Use
                    </Link>{" "}
                    and{" "}
                    <Link
                      to="/privacy-policy"
                      className="font-medium underline"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>

                <Button
                  className="w-full"
                  variant="accent"
                  disabled={isLoading || !formData.consent}
                >
                  {isLoading ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Right: Social + FAQ */}
          <div className="space-y-5">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-xl font-bold">
                  {contactChannels.title}
                </CardTitle>
                <p className="text-sm">{contactChannels.description}</p>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {contactChannels.channels.map((channel) => (
                    <a
                      key={channel.id}
                      href={channel.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:font-medium dark:hover:text-accent inline-flex items-center gap-2"
                    >
                      <channel.icon size={16} />
                      {channel.label}
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-none pb-0">
              <CardHeader>
                <CardTitle className="text-xl font-bold">
                  {contactFaqs.title}
                </CardTitle>
              </CardHeader>

              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {contactFaqs.faq.map((faq, index) => (
                    <AccordionItem key={faq.question} value={`faq-${index}`}>
                      <AccordionTrigger>{faq.question}</AccordionTrigger>
                      <AccordionContent>
                        <div className="flex gap-2">
                          <CheckCircle
                            size={16}
                            className="mt-0.5 text-success shrink-0"
                          />
                          <span>{faq.answer}</span>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
