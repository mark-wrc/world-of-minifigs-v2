import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
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
import PageHero from "@/components/shared/PageHero";
import { useContactForm } from "@/hooks/useContactForm";

const Contact = () => {
  const {
    formData,
    isLoading,
    handleChange,
    handleConsentChange,
    handleSubmit,
  } = useContactForm();

  return (
    <>
      <PageHero
        title={contactHero.title}
        highlight={contactHero.highlight}
        description={contactHero.description}
      />

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
                    placeholder="What can we help you with?"
                    value={formData.subject}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Your Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us more about your concern, question, or idea. We're happy to help!"
                    className="min-h-32"
                    required
                  />
                </div>

                <div className="flex items-start gap-2 text-sm">
                  <Checkbox
                    id="consent"
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
                  variant="gradient"
                  disabled={isLoading || !formData.consent}
                >
                  {isLoading ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Right: Social + FAQ */}
          <div className="space-y-5 self-start">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-xl font-bold">
                  {contactChannels.title}
                </CardTitle>
                <p className="text-sm">{contactChannels.description}</p>
              </CardHeader>

              {/* Socials */}
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

            {/* FAQ */}
            <Card className="shadow-none pb-0">
              <CardHeader>
                <CardTitle className="text-xl font-bold">
                  {contactFaqs.title}
                </CardTitle>
              </CardHeader>

              <CardContent>
                <Accordion type="single" collapsible>
                  {contactFaqs.faq.map((faq, index) => (
                    <AccordionItem
                      className="last:border-b-0"
                      key={faq.question}
                      value={`faq-${index}`}
                    >
                      <AccordionTrigger>{faq.question}</AccordionTrigger>
                      <AccordionContent className="flex items-start gap-2">
                        <CheckCircle
                          size={16}
                          className="mt-0.5 text-success shrink-0"
                        />
                        <span>{faq.answer}</span>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
};

export default Contact;
