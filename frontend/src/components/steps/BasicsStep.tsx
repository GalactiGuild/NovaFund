"use client";

import {
  ProjectFormData,
  PROJECT_CATEGORIES,
  ValidationErrors,
} from "@/types/project";

interface BasicsStepProps {
  data: ProjectFormData;
  errors: ValidationErrors;
  onChange: (field: keyof ProjectFormData, value: unknown) => void;
}

export default function BasicsStep({
  data,
  errors,
  onChange,
}: BasicsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-white">Project Basics</h2>
        <p className="mt-2 text-white/60 text-base">
          Let&apos;s start with the fundamentals of your project. Give it a
          compelling title and description.
        </p>
      </div>

      {/* Project Title */}
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-white/90 mb-2"
        >
          Project Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          id="title"
          value={data.title}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="e.g., Revolutionary Solar-Powered Water Purifier"
          className={`w-full px-4 py-3 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 transition-all text-white placeholder:text-white/30 ${
            errors.title
              ? "border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50 bg-red-500/5"
              : "border-white/10 focus:ring-primary/20 focus:border-primary/50 hover:border-white/20 hover:bg-white/10"
          }`}
          maxLength={100}
        />
        <div className="flex justify-between mt-1">
          <div>
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
          </div>
          <p className="text-xs text-white/40">{data.title.length}/100</p>
        </div>
      </div>

      {/* Project Description */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-white/90 mb-2"
        >
          Project Description <span className="text-red-400">*</span>
        </label>
        <textarea
          id="description"
          value={data.description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Describe your project in detail. What problem does it solve? What makes it unique? Who will benefit from it?"
          rows={8}
          className={`w-full px-4 py-3 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 transition-all resize-none text-white placeholder:text-white/30 ${
            errors.description
              ? "border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50 bg-red-500/5"
              : "border-white/10 focus:ring-primary/20 focus:border-primary/50 hover:border-white/20 hover:bg-white/10"
          }`}
          maxLength={2000}
        />
        <div className="flex justify-between mt-1">
          <div>
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
          </div>
          <p className="text-xs text-white/40">
            {data.description.length}/2000
          </p>
        </div>
      </div>

      {/* Category */}
      <div>
        <label
          htmlFor="category"
          className="block text-sm font-medium text-white/90 mb-2"
        >
          Category <span className="text-red-400">*</span>
        </label>
        <select
          id="category"
          value={data.category}
          onChange={(e) => onChange("category", e.target.value)}
          className={`w-full px-4 py-3 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 transition-all text-white ${
            errors.category
              ? "border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50 bg-red-500/5"
              : "border-white/10 focus:ring-primary/20 focus:border-primary/50 hover:border-white/20 hover:bg-white/10"
          }`}
        >
          <option value="" className="bg-zinc-900">
            Select a category
          </option>
          {PROJECT_CATEGORIES.map((category) => (
            <option key={category} value={category} className="bg-zinc-900">
              {category}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="text-sm text-red-500 mt-1">{errors.category}</p>
        )}
      </div>

      {/* Image URL (Optional) */}
      <div>
        <label
          htmlFor="imageUrl"
          className="block text-sm font-medium text-white/90 mb-2"
        >
          Project Image URL{" "}
          <span className="text-white/40 text-xs">(Optional)</span>
        </label>
        <input
          type="url"
          id="imageUrl"
          value={data.imageUrl}
          onChange={(e) => onChange("imageUrl", e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 hover:border-white/20 hover:bg-white/10 transition-all text-white placeholder:text-white/30"
        />
        <p className="text-xs text-white/40 mt-1">
          Provide a URL to an image that represents your project
        </p>
      </div>
    </div>
  );
}
